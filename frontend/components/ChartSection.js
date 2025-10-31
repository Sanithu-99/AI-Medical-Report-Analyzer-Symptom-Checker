import { useMemo } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
  Title,
} from "chart.js";
import { Bar } from "react-chartjs-2";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend, Title);

export default function ChartSection({ data = [] }) {
  const chartData = useMemo(() => {
    const labels = data.map((item) => item.label);
    const values = data.map((item) => item.value);
    return {
      labels,
      datasets: [
        {
          label: "Health Indicator",
          data: values,
          borderRadius: 12,
          backgroundColor: "rgba(26, 26, 26, 0.8)",
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
        text: "Health Overview",
        font: { size: 16, weight: "bold" },
        color: "#1a1a1a",
      },
      tooltip: {
        backgroundColor: "rgba(17, 24, 39, 0.95)",
        titleColor: "#fff",
        bodyColor: "#fff",
        borderWidth: 0,
        padding: 12,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: { display: false },
        ticks: { color: "#6b7280" },
      },
      x: {
        grid: { display: false },
        ticks: { color: "#6b7280" },
      },
    },
  };

  return (
    <section className="glass gradient-border p-6">
      <Bar data={chartData} options={options} height={240} />
    </section>
  );
}
