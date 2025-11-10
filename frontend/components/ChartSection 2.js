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
          backgroundColor: "rgba(52, 179, 160, 0.75)",
          borderColor: "rgba(52, 179, 160, 1)",
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
        text: "Health overview",
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
        grid: { color: "rgba(45, 55, 72, 0.3)" },
        ticks: { color: "#94a3b8" },
      },
      x: {
        grid: { display: false },
        ticks: { color: "#94a3b8" },
      },
    },
  };

  if (!data.length) {
    return (
      <section className="glass gradient-border rounded-3xl p-6 text-sm text-ocean/60">
        Upload a report to visualise key health indicators. The chart updates automatically when AI extracts insight
        values from your latest analysis.
      </section>
    );
  }

  return (
    <section className="glass gradient-border rounded-3xl p-6">
      <Bar data={chartData} options={options} height={240} />
    </section>
  );
}
