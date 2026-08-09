import styles from "./page.module.css";

export default function Home() {
  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <h1>SF Microclimate Weather</h1>
        <p>
          Hyperlocal weather for San Francisco and Marin County, blended from
          PurpleAir, Open-Meteo, NDBC, and NWS station data. Phase 0 scaffold
          — station providers and the interpolation engine land in later
          phases.
        </p>
        <div className={styles.status}>Phase 0: scaffold OK</div>
      </main>
    </div>
  );
}
