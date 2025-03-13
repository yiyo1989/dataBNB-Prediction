import { useEffect, FC } from "react";
import { cacheExchange, createClient, fetchExchange } from "urql";

// Crear cliente de urql para la consulta GraphQL
const client = createClient({
  url: "https://gateway.thegraph.com/api/dab2dcb5e9b606ffed6713989d5f4fb5/subgraphs/id/4kRuZVKCR9dsG2ePXhLSiKw5oaw3YMJo4nAwxZbUaqVY",
  exchanges: [cacheExchange, fetchExchange],
});

// Tipo para los datos de The Graph
interface Round {
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
}

interface GraphResponse {
  rounds: Round[];
}

// Tipo para el arreglo crudo que devuelve Binance, basado en la posición de cada dato
type BinanceKlineRaw = [
  number, // openTime
  string, // open
  string, // high
  string, // low
  string, // close
  string, // volume
  number, // closeTime
  string, // quoteAssetVolume
  number, // numberOfTrades
  string, // takerBuyBaseVolume
  string, // takerBuyQuoteVolume
  string // ignore
];

// Tipo para los datos formateados de Binance
type BinanceKline = {
  openTime: number;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
  closeTime: number;
  quoteAssetVolume: string;
  numberOfTrades: number;
  takerBuyBaseVolume: string;
  takerBuyQuoteVolume: string;
  ignore: string;
};

// Función que realiza la consulta para un día e intervalo dado y descarga el archivo JSON minificado
const fetchAndSaveDataForInterval = async (
  date: Date,
  startHour: number,
  endHour: number
): Promise<void> => {
  // Convertir la fecha al formato deseado para el nombre (DDMMYYYY)
  const year = date.getUTCFullYear();
  const month = (date.getUTCMonth() + 1).toString().padStart(2, "0");
  const day = date.getUTCDate().toString().padStart(2, "0");
  const dateStr = `${day}${month}${year}`;

  // Configurar los objetos Date para el inicio y fin del intervalo en GMT (UTC)
  const startDateTime = new Date(date);
  startDateTime.setUTCHours(startHour, 0, 0, 0);
  const endDateTime = new Date(date);
  if (endHour === 23) {
    // Para el último intervalo se considera hasta 23:59:59.999
    endDateTime.setUTCHours(23, 59, 59, 999);
  } else {
    endDateTime.setUTCHours(endHour, 0, 0, 0);
  }

  // Convertir a epoch (segundos)
  const startEpoch = Math.floor(startDateTime.getTime() / 1000);
  const endEpoch = Math.floor(endDateTime.getTime() / 1000);

  // Armar la consulta GraphQL usando los parámetros dinámicos
  const query = `
  {
    rounds(orderBy: epoch, orderDirection: asc, where: { startAt_gte: "${startEpoch}", startAt_lte: "${endEpoch}" })
    {    
      epoch
      position
      failed
      startAt
      closeAt
      totalBets
      totalAmount
      bullBets
      bullAmount
      bearBets
      bearAmount    
    }
  }`;

  try {
    // Ejecutar la consulta a The Graph pasando un objeto vacío para las variables
    const result = await client.query(query, {}).toPromise();
    const rounds = (result.data as GraphResponse).rounds;

    // Enriquecer cada round con datos de Binance
    const enrichedRounds = await Promise.all(
      rounds.map(async (round) => {
        const startAt: number = round.startAt;
        // Se define el rango para Binance: 3 horas antes y hasta 5 minutos antes del startAt
        const binanceStart = (startAt - 3 * 3600) * 1000;
        const binanceEnd = (startAt - 5 * 60) * 1000;
        const binanceUrl = `https://api.binance.com/api/v3/klines?symbol=BNBUSDT&interval=5m&startTime=${binanceStart}&endTime=${binanceEnd}&limit=36`;

        const binanceResponse = await fetch(binanceUrl);
        const binanceData = (await binanceResponse.json()) as BinanceKlineRaw[];

        // Mapear los datos a un objeto con nombres descriptivos
        const formattedBinanceData: BinanceKline[] = binanceData.map(
          (kline: BinanceKlineRaw) => ({
            openTime: kline[0],
            open: kline[1],
            high: kline[2],
            low: kline[3],
            close: kline[4],
            volume: kline[5],
            closeTime: kline[6],
            quoteAssetVolume: kline[7],
            numberOfTrades: kline[8],
            takerBuyBaseVolume: kline[9],
            takerBuyQuoteVolume: kline[10],
            ignore: kline[11],
          })
        );

        return {
          ...round,
          dataBinance: formattedBinanceData,
        };
      })
    );

    // Generar el JSON minificado (sin espacios ni saltos de línea)
    const jsonString = JSON.stringify(enrichedRounds);

    // Crear un Blob a partir del JSON minificado y disparar la descarga
    const blob = new Blob([jsonString], { type: "application/json" });
    const filename = `DataBnb${dateStr}-${startHour
      .toString()
      .padStart(2, "0")}-${
      endHour === 23 ? "23" : endHour.toString().padStart(2, "0")
    }.json`;

    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
  } catch (error) {
    console.error("Error fetching data for interval:", error);
  }
};

// Definir las propiedades que recibirá el componente
interface DataFetcherProps {
  startDateStr: string; // Formato "DD-MM-YYYY"
  endDateStr: string; // Formato "DD-MM-YYYY"
}

// Componente que recibe las fechas de inicio y fin y dispara el proceso
const DataFetcher: FC<DataFetcherProps> = ({ startDateStr, endDateStr }) => {
  // Función para parsear la cadena "DD-MM-YYYY" a un objeto Date en UTC
  const parseDate = (str: string): Date => {
    const [day, month, year] = str.split("-");
    // Se usa "T00:00:00Z" para indicar que la fecha es en UTC
    return new Date(`${year}-${month}-${day}T00:00:00Z`);
  };

  useEffect(() => {
    const startDate = parseDate(startDateStr);
    const endDate = parseDate(endDateStr);

    // Generar un array con todos los días entre startDate y endDate (inclusive)
    const days: Date[] = [];
    for (
      let d = new Date(startDate);
      d <= endDate;
      d.setUTCDate(d.getUTCDate() + 1)
    ) {
      days.push(new Date(d));
    }

    // Definir los intervalos horarios deseados para cada día en UTC
    const intervals = [
      { startHour: 0, endHour: 8 },
      { startHour: 8, endHour: 16 },
      { startHour: 16, endHour: 23 }, // 23 implica hasta 23:59:59.999
    ];

    // Para cada día y cada intervalo se ejecuta la consulta y se descarga el archivo
    (async () => {
      for (const day of days) {
        for (const interval of intervals) {
          await fetchAndSaveDataForInterval(
            day,
            interval.startHour,
            interval.endHour
          );
        }
      }
    })();
  }, [startDateStr, endDateStr]);

  return (
    <div>
      <p>
        Consultando datos desde {startDateStr} hasta {endDateStr} en horario GMT
        (UTC)...
      </p>
      <p>Se descargará un archivo JSON minificado por cada intervalo.</p>
    </div>
  );
};

export default DataFetcher;
