import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface PaymentRequest {
  paymentId: string;
  orderId: string;
  amount: string;
  currency: string;
  customerName: string;
  customerEmail: string;
  customerDocument: string;
  paymentMethod: string;
  domain: string;
  memberId: string;
  asaasApiKey: string;
  asaasEnvironment: string;
  // Card fields (optional)
  cardNumber?: string;
  cardExpiry?: string;
  cardCvv?: string;
  cardName?: string;
}

interface AsaasCustomer {
  id: string;
  name: string;
  email: string;
  cpfCnpj: string;
}

interface AsaasPayment {
  id: string;
  status: string;
  value: number;
  netValue: number;
  billingType: string;
  invoiceUrl?: string;
  bankSlipUrl?: string;
  pixQrCodeBase64?: string;
  pixCopiaECola?: string;
  dueDate: string;
  paymentDate?: string;
}

async function getAsaasBaseUrl(environment: string): Promise<string> {
  return environment === 'production' 
    ? 'https://api.asaas.com/v3'
    : 'https://sandbox.asaas.com/api/v3';
}

async function findOrCreateCustomer(
  apiKey: string, 
  baseUrl: string, 
  data: { name: string; email: string; cpfCnpj: string }
): Promise<AsaasCustomer> {
  console.log('Finding or creating Asaas customer...');
  
  // Search for existing customer
  const searchResponse = await fetch(`${baseUrl}/customers?cpfCnpj=${data.cpfCnpj}`, {
    headers: { 
      'access_token': apiKey,
      'Content-Type': 'application/json',
    },
  });
  
  const searchResult = await searchResponse.json();
  
  if (searchResult.data && searchResult.data.length > 0) {
    console.log('Found existing customer:', searchResult.data[0].id);
    return searchResult.data[0];
  }
  
  // Create new customer
  const createResponse = await fetch(`${baseUrl}/customers`, {
    method: 'POST',
    headers: { 
      'access_token': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: data.name || 'Cliente',
      email: data.email,
      cpfCnpj: data.cpfCnpj,
    }),
  });
  
  const customer = await createResponse.json();
  
  if (customer.errors) {
    throw new Error(customer.errors[0]?.description || 'Erro ao criar cliente no Asaas');
  }
  
  console.log('Created new customer:', customer.id);
  return customer;
}

interface SplitConfig {
  wallet_id: string;
  wallet_name: string | null;
  split_type: 'fixed' | 'percentage';
  split_value: number;
}

interface AppliedSplit {
  wallet_id: string;
  wallet_name: string | null;
  split_type: 'fixed' | 'percentage';
  split_value: number;
  split_amount: number;
}

function calculateSplitAmount(splitConfig: SplitConfig, totalAmount: number): number {
  if (splitConfig.split_type === 'fixed') {
    return Math.min(splitConfig.split_value, totalAmount);
  }
  return (splitConfig.split_value / 100) * totalAmount;
}

async function createAsaasPayment(
  apiKey: string,
  baseUrl: string,
  customerId: string,
  paymentMethod: string,
  amount: number,
  externalReference: string,
  cardData?: { number: string; expiry: string; cvv: string; name: string },
  splitConfigs?: SplitConfig[]
): Promise<{ payment: AsaasPayment; appliedSplits: AppliedSplit[] }> {
  console.log(`Creating Asaas ${paymentMethod} payment...`);
  
  const billingTypeMap: Record<string, string> = {
    pix: 'PIX',
    boleto: 'BOLETO',
    credit_card: 'CREDIT_CARD',
  };
  
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 3); // 3 days from now
  
  const paymentPayload: Record<string, unknown> = {
    customer: customerId,
    billingType: billingTypeMap[paymentMethod] || 'PIX',
    value: amount,
    dueDate: dueDate.toISOString().split('T')[0],
    externalReference,
    description: `Pagamento Pedido #${externalReference}`,
  };
  
  // Calculate and add splits if configured
  const appliedSplits: AppliedSplit[] = [];
  if (splitConfigs && splitConfigs.length > 0) {
    const splitArray = splitConfigs.map(config => {
      const splitAmount = calculateSplitAmount(config, amount);
      appliedSplits.push({
        wallet_id: config.wallet_id,
        wallet_name: config.wallet_name,
        split_type: config.split_type,
        split_value: config.split_value,
        split_amount: splitAmount,
      });
      
      return {
        walletId: config.wallet_id,
        ...(config.split_type === 'fixed' 
          ? { fixedValue: config.split_value }
          : { percentualValue: config.split_value }),
      };
    });
    
    paymentPayload.split = splitArray;
    console.log('Applied splits:', JSON.stringify(splitArray));
  }
  
  // Add credit card data if applicable
  if (paymentMethod === 'credit_card' && cardData) {
    const [expMonth, expYear] = cardData.expiry.split('/');
    paymentPayload.creditCard = {
      holderName: cardData.name,
      number: cardData.number,
      expiryMonth: expMonth,
      expiryYear: `20${expYear}`,
      ccv: cardData.cvv,
    };
    paymentPayload.creditCardHolderInfo = {
      name: cardData.name,
      cpfCnpj: '', // Will be filled from customer
    };
  }
  
  const response = await fetch(`${baseUrl}/payments`, {
    method: 'POST',
    headers: { 
      'access_token': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(paymentPayload),
  });
  
  const payment = await response.json();
  
  if (payment.errors) {
    throw new Error(payment.errors[0]?.description || 'Erro ao criar cobrança no Asaas');
  }
  
  console.log('Created payment:', payment.id, 'Status:', payment.status);
  
  // If PIX, get the QR Code
  if (paymentMethod === 'pix') {
    const pixResponse = await fetch(`${baseUrl}/payments/${payment.id}/pixQrCode`, {
      headers: { 
        'access_token': apiKey,
        'Content-Type': 'application/json',
      },
    });
    
    const pixData = await pixResponse.json();
    payment.pixQrCodeBase64 = pixData.encodedImage;
    payment.pixCopiaECola = pixData.payload;
  }
  
  return { payment, appliedSplits };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Bitrix Payment Process Handler called');
    
    const paymentRequest: PaymentRequest = await req.json();
    console.log('Payment request:', JSON.stringify({ ...paymentRequest, asaasApiKey: '***' }));
    
    // Validate required fields
    if (!paymentRequest.asaasApiKey) {
      throw new Error('Chave API do Asaas não configurada');
    }
    
    if (!paymentRequest.customerDocument) {
      throw new Error('CPF/CNPJ do cliente é obrigatório');
    }
    
    if (!paymentRequest.amount || parseFloat(paymentRequest.amount) <= 0) {
      throw new Error('Valor do pagamento inválido');
    }
    
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const baseUrl = await getAsaasBaseUrl(paymentRequest.asaasEnvironment);
    const amount = parseFloat(paymentRequest.amount);
    
    // Find or create customer in Asaas
    const customer = await findOrCreateCustomer(
      paymentRequest.asaasApiKey,
      baseUrl,
      {
        name: paymentRequest.customerName,
        email: paymentRequest.customerEmail,
        cpfCnpj: paymentRequest.customerDocument.replace(/\D/g, ''),
      }
    );
    
    // Create external reference combining Bitrix IDs
    const externalReference = `bitrix_${paymentRequest.orderId}_${paymentRequest.paymentId}`;
    
    // Create card data if credit card payment
    let cardData;
    if (paymentRequest.paymentMethod === 'credit_card' && paymentRequest.cardNumber) {
      cardData = {
        number: paymentRequest.cardNumber,
        expiry: paymentRequest.cardExpiry || '',
        cvv: paymentRequest.cardCvv || '',
        name: paymentRequest.cardName || paymentRequest.customerName,
      };
    }
    
    // Find installation to get tenant_id - use member_id as primary key
    const { data: installation, error: instError } = await supabase
      .from('bitrix_installations')
      .select('tenant_id')
      .eq('member_id', paymentRequest.memberId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    if (instError) {
      console.error('Error finding installation:', instError);
    }
    
    // Fetch active split configurations for the tenant
    let splitConfigs: SplitConfig[] = [];
    if (installation?.tenant_id) {
      const { data: splits } = await supabase
        .from('split_configurations')
        .select('wallet_id, wallet_name, split_type, split_value')
        .eq('tenant_id', installation.tenant_id)
        .eq('is_active', true);
      
      if (splits && splits.length > 0) {
        splitConfigs = splits as SplitConfig[];
        console.log('Found active splits:', splitConfigs.length);
      }
    }
    
    // Create payment in Asaas with splits
    const { payment, appliedSplits } = await createAsaasPayment(
      paymentRequest.asaasApiKey,
      baseUrl,
      customer.id,
      paymentRequest.paymentMethod,
      amount,
      externalReference,
      cardData,
      splitConfigs
    );
    
    // Store transaction in database
    if (installation?.tenant_id) {
      const paymentMethodMap: Record<string, string> = {
        pix: 'pix',
        boleto: 'boleto',
        credit_card: 'credit_card',
      };
      
      const { data: insertedTransaction } = await supabase.from('transactions').insert({
        tenant_id: installation.tenant_id,
        asaas_id: payment.id,
        amount,
        payment_method: paymentMethodMap[paymentRequest.paymentMethod] || 'pix',
        status: payment.status === 'CONFIRMED' || payment.status === 'RECEIVED' ? 'confirmed' : 'pending',
        customer_name: paymentRequest.customerName,
        customer_email: paymentRequest.customerEmail,
        customer_document: paymentRequest.customerDocument,
        due_date: payment.dueDate,
        payment_url: payment.invoiceUrl || payment.bankSlipUrl,
        bitrix_entity_type: 'invoice',
        bitrix_entity_id: paymentRequest.orderId,
      }).select('id').single();
      
      console.log('Transaction stored in database');
      
      // Create configurable activity with badge in Bitrix24
      if (insertedTransaction?.id) {
        try {
          const { data: inst } = await supabase
            .from('bitrix_installations')
            .select('client_endpoint, access_token, domain')
            .eq('member_id', paymentRequest.memberId)
            .order('updated_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          
          const clientEndpoint = inst?.client_endpoint || (inst?.domain ? `https://${inst.domain}/rest/` : null);
          if (clientEndpoint && inst?.access_token) {
            const methodLabel: Record<string, string> = { pix: 'PIX', boleto: 'Boleto', credit_card: 'Cartão' };
            const actResult = await fetch(`${clientEndpoint}crm.activity.configurable.add`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                auth: inst.access_token,
                ownerTypeId: 2,
                ownerId: parseInt(paymentRequest.orderId) || 0,
                fields: { completed: false, badgeCode: 'asaas_charge_created' },
                layout: {
                  header: { title: `Cobrança Asaas - ${methodLabel[paymentRequest.paymentMethod] || 'PIX'}` },
                  body: {
                    blocks: {
                      info: {
                        type: 'lineOfBlocks',
                        properties: {
                          blocks: {
                            value: { type: 'text', properties: { value: `R$ ${amount.toFixed(2).replace('.', ',')}` } },
                            status: { type: 'text', properties: { value: 'Pendente', color: 'warning' } },
                          },
                        },
                      },
                    },
                  },
                },
              }),
            });
            const actData = await actResult.json();
            if (actData.result?.id) {
              await supabase.from('transactions')
                .update({ bitrix_activity_id: String(actData.result.id) })
                .eq('id', insertedTransaction.id);
              console.log('Created activity:', actData.result.id);
            }
          }
        } catch (actErr) {
          console.error('Error creating activity:', actErr);
        }
      }
      
      // Store applied splits
      if (insertedTransaction && appliedSplits.length > 0) {
        await supabase.from('transaction_splits').insert(
          appliedSplits.map(split => ({
            transaction_id: insertedTransaction.id,
            wallet_id: split.wallet_id,
            wallet_name: split.wallet_name,
            split_type: split.split_type,
            split_value: split.split_value,
            split_amount: split.split_amount,
          }))
        );
        console.log('Applied splits stored:', appliedSplits.length);
      }
    }
    
    // Prepare response based on payment method
    let responseData: Record<string, unknown> = {
      success: true,
      transactionId: payment.id,
      status: payment.status,
    };
    
    if (paymentRequest.paymentMethod === 'pix') {
      responseData = {
        ...responseData,
        qrCodeImage: `data:image/png;base64,${payment.pixQrCodeBase64}`,
        pixCode: payment.pixCopiaECola,
      };
    } else if (paymentRequest.paymentMethod === 'boleto') {
      responseData = {
        ...responseData,
        boletoUrl: payment.bankSlipUrl,
        boletoDigitableLine: payment.invoiceUrl, // This would be the digitable line
        dueDate: new Date(payment.dueDate).toLocaleDateString('pt-BR'),
      };
    }
    
    return new Response(JSON.stringify(responseData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
    
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in bitrix-payment-process:', error);
    
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
