import { createRoot } from "react-dom/client";
import DataFetcher from "./DataFetcher";
//import App from './App.tsx'
//import WrappedExampleComponent from './WrappedExampleComponent.tsx'

createRoot(document.getElementById("root")!).render(
  <DataFetcher startDateStr="12-02-2025" endDateStr="27-02-2025" />
);
