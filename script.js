async function logElToqueData() {
    // Reutilizando las credenciales de tu script.js
    const ELTOQUE_API_URL = "https://ebihagvhgakvuoeoukbc.supabase.co";
    const ELTOQUE_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImViaWhhZ3ZoZ2FrdnVvZW91a2JjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxMTM2MTEsImV4cCI6MjA4MDY4OTYxMX0.T3UNdA8bTSpDzLdNb19lTzifqLwfQPAp5fSyIVBECI8";
    const proxyUrl = "https://corsproxy.io/?"; 
    
    console.log("⚙️ Intentando conectar con la API de El Toque...");

    try {
        const targetUrl = encodeURIComponent(ELTOQUE_API_URL);
        const response = await fetch(proxyUrl + targetUrl, {
            method: 'GET',
            headers: { 
                'Authorization': `Bearer ${ELTOQUE_TOKEN}`, 
                'Content-Type': 'application/json' 
            }
        });

        if (!response.ok) {
            throw new Error(`Error HTTP: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        const tasas = data.tasas || data; 

        console.log("------------------------------------------");
        console.log("--- 📊 DATOS BRUTOS DE LA API DE EL TOQUE ---");
        console.log(data); // Muestra el JSON completo

        // Resumen rápido para identificar monedas
        console.log("✅ Monedas encontradas en la clave 'tasas' (o raíz):");
        console.log(`Códigos recibidos: ${Object.keys(tasas || {}).join(', ')}`);
        
        // Verificación de las monedas clave
        console.log("Valores específicos (si existen):");
        console.log(`  - USD: ${tasas.USD || 'NO RECIBIDO'}`);
        console.log(`  - EUR: ${tasas.EUR || 'NO RECIBIDO'}`);
        console.log(`  - MLC: ${tasas.MLC || 'NO RECIBIDO'}`);
        console.log(`  - CAD: ${tasas.CAD || 'NO RECIBIDO'}`);
        console.log(`  - USDT (posible Zelle): ${tasas.USDT || 'NO RECIBIDO'}`);
        
        console.log("------------------------------------------");


    } catch (error) {
        console.error("❌ Error al conectar con la API. Revise su Token o CORS:", error.message);
    }
}

// ⚠️ EJECUTA ESTO EN LA CONSOLA DESPUÉS DE PEGAR TODO EL CÓDIGO:
// logElToqueData();
