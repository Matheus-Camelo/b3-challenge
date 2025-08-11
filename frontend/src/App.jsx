import { useState } from 'react'
import axios from 'axios'
import { Button } from '@/components/ui/button.jsx'
import { Input } from '@/components/ui/input.jsx'
import { Label } from '@/components/ui/label.jsx'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx'
import { Alert, AlertDescription } from '@/components/ui/alert.jsx'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { TrendingUp, Calendar, DollarSign } from 'lucide-react'
import './App.css'

function App() {
  const [symbols, setSymbols] = useState('PETR4,VALE3')
  const [startDate, setStartDate] = useState('2024-01-01')
  const [endDate, setEndDate] = useState('2024-01-31')
  const [chartData, setChartData] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Cores para diferentes ativos no gráfico
  const colors = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#00ff00', '#ff00ff']

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')
    setChartData([])

    try {
      // Converter string de símbolos em array
      const symbolsArray = symbols.split(',').map(s => s.trim().toUpperCase()).filter(s => s)
      
      if (symbolsArray.length === 0) {
        throw new Error('Por favor, insira pelo menos um símbolo de ativo')
      }

      // Fazer requisição para o backend
      const response = await axios.post('http://localhost:3001/api/quotes', {
        symbols: symbolsArray,
        startDate,
        endDate
      })

      if (response.data.success) {
        // Processar dados para o gráfico
        const processedData = processDataForChart(response.data.data)
        setChartData(processedData)
        setSuccess(`Dados carregados com sucesso! ${symbolsArray.length} ativo(s) consultado(s).`)
      } else {
        throw new Error('Erro ao buscar dados do servidor')
      }
    } catch (err) {
      console.error('Erro ao buscar cotações:', err)
      setError(err.response?.data?.message || err.message || 'Erro ao buscar cotações')
    } finally {
      setLoading(false)
    }
  }

  // Função para processar dados e organizar por data
  const processDataForChart = (data) => {
    const groupedByDate = {}
    
    data.forEach(item => {
      if (!groupedByDate[item.date]) {
        groupedByDate[item.date] = { date: item.date }
      }
      groupedByDate[item.date][item.symbol] = item.close
    })

    return Object.values(groupedByDate).sort((a, b) => new Date(a.date) - new Date(b.date))
  }

  // Obter símbolos únicos dos dados para renderizar as linhas
  const uniqueSymbols = [...new Set(chartData.flatMap(item => 
    Object.keys(item).filter(key => key !== 'date')
  ))]

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold text-foreground flex items-center justify-center gap-2">
            <TrendingUp className="h-8 w-8 text-primary" />
            B3 Cotações
          </h1>
          <p className="text-muted-foreground">
            Consulte preços de fechamento diário de ativos da B3
          </p>
        </div>

        {/* Formulário de consulta */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Consultar Cotações
            </CardTitle>
            <CardDescription>
              Insira os símbolos dos ativos e o período para consulta
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="symbols">Ativos (separados por vírgula)</Label>
                  <Input
                    id="symbols"
                    type="text"
                    placeholder="Ex: PETR4, VALE3, ITUB4"
                    value={symbols}
                    onChange={(e) => setSymbols(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="startDate" className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    Data de Início
                  </Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endDate" className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    Data de Fim
                  </Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    required
                  />
                </div>
              </div>
              <Button type="submit" disabled={loading} className="w-full">
                {loading ? 'Consultando...' : 'Consultar Cotações'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Mensagens de erro e sucesso */}
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert>
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        )}

        {/* Gráfico */}
        {chartData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Evolução dos Preços</CardTitle>
              <CardDescription>
                Preços de fechamento diário dos ativos selecionados
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-96">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="date" 
                      tick={{ fontSize: 12 }}
                      angle={-45}
                      textAnchor="end"
                      height={60}
                    />
                    <YAxis 
                      tick={{ fontSize: 12 }}
                      label={{ value: 'Preço (R$)', angle: -90, position: 'insideLeft' }}
                    />
                    <Tooltip 
                      labelFormatter={(value) => `Data: ${value}`}
                      formatter={(value, name) => [`R$ ${value.toFixed(2)}`, name]}
                    />
                    <Legend />
                    {uniqueSymbols.map((symbol, index) => (
                      <Line
                        key={symbol}
                        type="monotone"
                        dataKey={symbol}
                        stroke={colors[index % colors.length]}
                        strokeWidth={2}
                        dot={{ r: 3 }}
                        activeDot={{ r: 5 }}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Informações adicionais */}
        <Card>
          <CardHeader>
            <CardTitle>Informações</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>• Os dados são obtidos de APIs externas de cotações da B3</p>
            <p>• O sistema implementa cache para otimizar consultas repetidas</p>
            <p>• Insira os símbolos dos ativos separados por vírgula (ex: PETR4, VALE3)</p>
            <p>• O gráfico exibe a evolução dos preços de fechamento no período selecionado</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default App

