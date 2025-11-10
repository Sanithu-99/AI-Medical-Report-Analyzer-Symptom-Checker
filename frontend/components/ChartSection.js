import { useMemo } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
  Title,
} from "chart.js";
import { Line } from "react-chartjs-2";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip, Legend, Title);

export default function ChartSection({ data = [] }) {
  const chartData = useMemo(() => {
    const labels = data.map((item) => item.label);
    const values = data.map((item) => item.value);
    return {
      labels,
      datasets: [
        {
          label: "Health score",
          data: values,
          tension: 0.35,
          pointRadius: 4,
          pointHoverRadius: 6,
          borderWidth: 2.5,
          fill: true,
          borderColor: "rgba(52, 179, 160, 0.9)",
          backgroundColor: (context) => {
            const chart = context.chart;
            const { ctx, chartArea } = chart;
            if (!chartArea) {
              return null;
            }
            const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
            gradient.addColorStop(0, "rgba(52, 179, 160, 0.35)");
            gradient.addColorStop(1, "rgba(52, 179, 160, 0.05)");
            return gradient;
          },
        },
      ],
    };
  }, [data]);

  const options = {
    responsive: true,
    plugins: {
      legend: { display: false },
      title: {
        display: true,
        text: "Health score trend",
        font: { size: 16, weight: "bold" },
        color: "#1f3b57",
      },
      tooltip: {
        backgroundColor: "rgba(31, 59, 87, 0.95)",
        titleColor: "#e3f2ff",
        bodyColor: "#f8fbff",
        borderWidth: 0,
        padding: 12,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        suggestedMax: 100,
        grid: { color: "rgba(45, 55, 72, 0.15)" },
        ticks: { color: "#6b7280", padding: 10 },
      },
      x: {
        grid: { display: false },
        ticks: { color: "#6b7280" },
      },
    },
  };

  if (!data.length) {
    return (
      <section className="section-card text-sm text-ocean/60">
        Upload analysed reports to visualise the health score trend. Each new report extends the timeline automatically.
      </section>
    );
  }

  return (
    <section className="section-card">
      <Line data={chartData} options={options} height={240} />
    </section>
  );
}
