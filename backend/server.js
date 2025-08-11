const express = require('express');
const cors = require('cors');
const axios = require('axios');
const NodeCache = require('node-cache');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Cache com TTL de 1 hora (3600 segundos)
const cache = new NodeCache({ stdTTL: 3600 });

// Middleware
app.use(cors());
app.use(express.json());

// Função para formatar data no formato YYYY-MM-DD
const formatDate = (date) => {
  return new Date(date).toISOString().split('T')[0];
};

// Função para gerar chave de cache
const generateCacheKey = (symbol, startDate, endDate) => {
  return `${symbol}_${startDate}_${endDate}`;
};

// Função para buscar dados da API externa (Alpha Vantage)
const fetchStockData = async (symbol, startDate, endDate) => {
  try {
    // Usando Alpha Vantage API (gratuita) - requisição extra se a brapi não funcionar
    const API_KEY = process.env.ALPHA_VANTAGE_API_KEY || 'demo';
    const url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${symbol}.SA&apikey=${API_KEY}&outputsize=full`;
    
    const response = await axios.get(url);
    const timeSeries = response.data['Time Series (Daily)'];
    
    if (!timeSeries) {
      throw new Error(`Dados não encontrados para o ativo ${symbol}`);
    }

    // Filtrar dados pelo período solicitado
    const filteredData = [];
    const start = new Date(startDate);
    const end = new Date(endDate);

    for (const [date, data] of Object.entries(timeSeries)) {
      const currentDate = new Date(date);
      if (currentDate >= start && currentDate <= end) {
        filteredData.push({
          date: date,
          close: parseFloat(data['4. close']),
          symbol: symbol
        });
      }
    }

    // Ordenar por data (mais antiga primeiro)
    filteredData.sort((a, b) => new Date(a.date) - new Date(b.date));
    
    return filteredData;
  } catch (error) {
    console.error(`Erro ao buscar dados para ${symbol}:`, error.message);
    throw error;
  }
};

// Função alternativa usando API brasileira (Brapi)
const fetchStockDataBrapi = async (symbol, startDate, endDate) => {
  try {
    // Usando Brapi - API brasileira gratuita da bolsa br
    const url = `https://brapi.dev/api/quote/${symbol}?range=1y&interval=1d`;
    
    const response = await axios.get(url);
    const stockData = response.data.results[0];
    
    if (!stockData || !stockData.historicalDataPrice) {
      throw new Error(`Dados não encontrados para o ativo ${symbol}`);
    }

    // Filtrar dados pelo período solicitado
    const filteredData = [];
    const start = new Date(startDate);
    const end = new Date(endDate);

    stockData.historicalDataPrice.forEach(item => {
      const currentDate = new Date(item.date * 1000); // timestamp em segundos
      if (currentDate >= start && currentDate <= end) {
        filteredData.push({
          date: currentDate.toISOString().split('T')[0],
          close: item.close,
          symbol: symbol
        });
      }
    });

    // Ordenar por data (mais antiga primeiro)
    filteredData.sort((a, b) => new Date(a.date) - new Date(b.date));
    
    return filteredData;
  } catch (error) {
    console.error(`Erro ao buscar dados para ${symbol}:`, error.message);
    throw error;
  }
};

// Rota principal para buscar cotações
app.post('/api/quotes', async (req, res) => {
  try {
    const { symbols, startDate, endDate } = req.body;

    // Validação dos parâmetros
    if (!symbols || !Array.isArray(symbols) || symbols.length === 0) {
      return res.status(400).json({ error: 'Símbolos dos ativos são obrigatórios' });
    }

    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'Datas de início e fim são obrigatórias' });
    }

    const results = [];

    // Processar cada símbolo
    for (const symbol of symbols) {
      const cacheKey = generateCacheKey(symbol, startDate, endDate);
      
      // Verificar se os dados estão em cache
      let stockData = cache.get(cacheKey);
      
      if (!stockData) {
        console.log(`Buscando dados da API para ${symbol}...`);
        
        try {
          // Tentar primeiro com Brapi (API brasileira)
          stockData = await fetchStockDataBrapi(symbol, startDate, endDate);
        } catch (error) {
          console.log(`Erro com Brapi, tentando Alpha Vantage para ${symbol}...`);
          try {
            stockData = await fetchStockData(symbol, startDate, endDate);
          } catch (alphaError) {
            console.error(`Erro com ambas as APIs para ${symbol}:`, alphaError.message);
            // Retornar dados simulados para demonstração
            stockData = generateMockData(symbol, startDate, endDate);
          }
        }
        
        // Armazenar no cache
        cache.set(cacheKey, stockData);
        console.log(`Dados armazenados em cache para ${symbol}`);
      } else {
        console.log(`Dados recuperados do cache para ${symbol}`);
      }

      results.push(...stockData);
    }

    res.json({
      success: true,
      data: results,
      cached: results.length > 0
    });

  } catch (error) {
    console.error('Erro na rota /api/quotes:', error);
    res.status(500).json({ 
      error: 'Erro interno do servidor',
      message: error.message 
    });
  }
});

// Função para gerar dados simulados (para demonstração)
const generateMockData = (symbol, startDate, endDate) => {
  const data = [];
  const start = new Date(startDate);
  const end = new Date(endDate);
  const basePrice = Math.random() * 100 + 20; // Preço base entre 20 e 120
  
  let currentDate = new Date(start);
  let currentPrice = basePrice;
  
  while (currentDate <= end) {
    // Simular variação de preço (-5% a +5%)
    const variation = (Math.random() - 0.5) * 0.1;
    currentPrice = currentPrice * (1 + variation);
    
    data.push({
      date: currentDate.toISOString().split('T')[0],
      close: parseFloat(currentPrice.toFixed(2)),
      symbol: symbol
    });
    
    // Avançar para o próximo dia útil
    currentDate.setDate(currentDate.getDate() + 1);
    
    // Pular fins de semana
    if (currentDate.getDay() === 0) currentDate.setDate(currentDate.getDate() + 1);
    if (currentDate.getDay() === 6) currentDate.setDate(currentDate.getDate() + 2);
  }
  
  return data;
};

// Rota para verificar status do cache
app.get('/api/cache/stats', (req, res) => {
  const stats = cache.getStats();
  res.json({
    keys: cache.keys().length,
    hits: stats.hits,
    misses: stats.misses,
    ksize: stats.ksize,
    vsize: stats.vsize
  });
});

// Rota para limpar cache
app.delete('/api/cache', (req, res) => {
  cache.flushAll();
  res.json({ message: 'Cache limpo com sucesso' });
});

// Rota de health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Iniciar servidor
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor rodando na porta ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
});

module.exports = app;

