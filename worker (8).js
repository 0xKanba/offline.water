const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,HEAD,POST,OPTIONS',
  'Access-Control-Max-Age': '86400',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function handleOptions(request) {
  return new Response(null, { headers: corsHeaders });
}

export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') {
      return handleOptions(request);
    }

    const url = new URL(request.url);
    const pathname = url.pathname.replace(/\/+$/, '');

    if (pathname === '/sync' && request.method === 'POST') {
      try {
        const data = await request.json();
        const records = Array.isArray(data.records) ? data.records : [data.records];
        
        // Save each record to KV database
        for (const record of records) {
          // Store record as JSON string, using its ID as the key
          await env.WATER_DB.put(`record:${record.id}`, JSON.stringify(record));
        }

        return new Response(JSON.stringify({ success: true, message: 'Synced successfully' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: 'Failed to process request' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Optional: Get all records (for provider sync down later)
    if (pathname === '/records' && request.method === 'GET') {
      const list = await env.WATER_DB.list({ prefix: 'record:' });
      const records = [];
      for (const key of list.keys) {
        const item = await env.WATER_DB.get(key.name);
        if (item) records.push(JSON.parse(item));
      }
      return new Response(JSON.stringify(records), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response('Water Service API is running', {
      headers: corsHeaders,
    });
  },
};
