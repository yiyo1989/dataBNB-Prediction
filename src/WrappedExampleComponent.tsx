import { useEffect, useState } from 'react';
import { cacheExchange, createClient, fetchExchange, Provider, useQuery } from 'urql';
const client = createClient({
  url: 'https://gateway.thegraph.com/api/dab2dcb5e9b606ffed6713989d5f4fb5/subgraphs/id/4kRuZVKCR9dsG2ePXhLSiKw5oaw3YMJo4nAwxZbUaqVY',
  exchanges: [cacheExchange, fetchExchange],
});

// Definir tipos para los datos de The Graph
type Round = {
  epoch: string;
  position: string;
  failed: boolean;
  startAt: number;
  closeAt: number;
  totalBets: string;
  totalAmount: string;
  bullBets: string;
  bullAmount: string;
  bearBets: string;
  bearAmount: string;
};

type GraphResponse = {
  rounds: Round[];
};

// Definir tipos para los datos de Binance con nombres descriptivos
type BinanceKline = {
  openTime: number;          // Tiempo de apertura
  open: string;              // Precio de apertura
  high: string;              // Precio más alto
  low: string;               // Precio más bajo
  close: string;             // Precio de cierre
  volume: string;            // Volumen
  closeTime: number;         // Tiempo de cierre
  quoteAssetVolume: string;  // Volumen en la moneda de cotización
  numberOfTrades: number;    // Número de trades
  takerBuyBaseVolume: string; // Volumen comprado en la moneda base
  takerBuyQuoteVolume: string; // Volumen comprado en la moneda de cotización
  ignore: string;            // Campo ignorado
};

type EnrichedRound = Round & {
  dataBinance: BinanceKline[];
};

//28-02-2025 0 horas: 1740700800 a 28-02-2025 8 horas: 1740729600
const QUERY = `{
  rounds(orderBy: epoch orderDirection:asc skip: 2 where: { startAt_gte: "1741104000" startAt_lte:"1741132740"})
  {    
    epoch
    position
    failed
    startAt
    failed
    closeAt
    totalBets
    totalAmount
    bullBets
    bullAmount
    bearBets
    bearAmount    
  }
}`;
const ExampleComponent = () => {
  const [result] = useQuery<GraphResponse>({ query: QUERY });
  const { data, fetching, error } = result;
  const [enrichedData, setEnrichedData] = useState<EnrichedRound[]>([]);

  useEffect(() => {
    if (!fetching && !error && data) {
      const fetchBinanceData = async () => {
        const enrichedRounds = await Promise.all(
          data.rounds.map(async (round) => {
            const startAt = round.startAt; // Tiempo de inicio en segundos
            const endTime = (startAt - 5 * 60) * 1000; // 5 minutos antes de startAt en milisegundos
            const startTime = (startAt - 3 * 3600) * 1000; // 3 horas antes de startAt en milisegundos

            const binanceUrl = `https://api.binance.com/api/v3/klines?symbol=BNBUSDT&interval=5m&startTime=${startTime}&endTime=${endTime}&limit=36`;
            const binanceResponse = await fetch(binanceUrl);
            const binanceData: Array<Array<string | number>> = await binanceResponse.json();

            // Mapear los datos de Binance a un objeto con nombres descriptivos
            const formattedBinanceData: BinanceKline[] = binanceData.map((kline) => ({
              openTime: kline[0] as number,
              open: kline[1] as string,
              high: kline[2] as string,
              low: kline[3] as string,
              close: kline[4] as string,
              volume: kline[5] as string,
              closeTime: kline[6] as number,
              quoteAssetVolume: kline[7] as string,
              numberOfTrades: kline[8] as number,
              takerBuyBaseVolume: kline[9] as string,
              takerBuyQuoteVolume: kline[10] as string,
              ignore: kline[11] as string,
            }));

            return {
              ...round,
              dataBinance: formattedBinanceData,
            };
          })
        );

        setEnrichedData(enrichedRounds);
      };

      fetchBinanceData();
    }
  }, [data, fetching, error]);

  if (fetching) return <p>Loading...</p>;

  if (error) return <p>Error: {error.message}</p>;

  return <pre>{JSON.stringify(enrichedData, null, 2)}</pre>;
}
const WrappedExampleComponent = () => (
  <Provider value={client}>
    <ExampleComponent />
  </Provider>
);
export default WrappedExampleComponent;