const axios = require('axios');
const https = require('https');

const agent = new https.Agent({  
  rejectUnauthorized: false
});

async function run() {
  const token = 'JWT_ACCESS_TOKEN'; // We don't have a token, but let's check if the endpoint returns 401 or if there's any public endpoints, or if we can see the response wrapper structure.
  // Wait, let's login first!
  try {
    console.log("Logging in...");
    const loginRes = await axios.post('https://localhost:44324/auth/login', {
      email: 'admin@company.test',
      password: 'Secret123!'
    }, { httpsAgent: agent });
    
    const tokens = loginRes.data;
    console.log("Login success! Tokens:", tokens);
    
    const headers = { Authorization: `Bearer ${tokens.accessToken}` };
    
    const endpoints = [
      '/customer',
      '/sale',
      '/purchase',
      '/payment',
      '/cashregister'
    ];
    
    for (const url of endpoints) {
      try {
        const res = await axios.get(`https://localhost:44324${url}`, { headers, httpsAgent: agent });
        console.log(`\nEndpoint: ${url}`);
        console.log(`Status: ${res.status}`);
        console.log(`Data (truncated):`, JSON.stringify(res.data).slice(0, 300));
      } catch (err) {
        console.error(`Endpoint ${url} failed:`, err.response ? err.response.status : err.message);
        if (err.response) console.log("Error details:", err.response.data);
      }
    }
    
  } catch (err) {
    console.error("Login failed:", err.response ? err.response.data : err.message);
  }
}

run();
