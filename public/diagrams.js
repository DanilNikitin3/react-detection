const charts = [];

// Генерация случайных данных
function generateChartData() {
  const labels = [];
  const dataPoints = [];
  const anomalyPoints = [];
  
  for (let i = 0; i < 24; i++) {
    labels.push(`${i}:00`);
    if (i > 17 && i < 20) {
      value = 50 + Math.sin(i / 2) * 30 + Math.random() * 10;
      dataPoints.push(value);
    } else {
      value = Math.random() * 10;
      dataPoints.push(value);
    }
    if (i > 17 && i < 20) {
      anomalyPoints.push({
        x: i,
        y: value
      });
    } else {
      anomalyPoints.push(null);
    }
  }
  return { labels, dataPoints, anomalyPoints };
}

// Создание графиков
function createCharts() {
  const container = document.getElementById('charts-container');

  for (let i = 1; i <= 7; i++) {
    const wrapper = document.createElement('div');
    wrapper.className = 'chart-wrapper';
    wrapper.id = `wrapper-${i}`;
    
    // Добавляем кнопку сброса
    const resetBtn = document.createElement('button');
    resetBtn.className = 'reset-btn';
    resetBtn.addEventListener('click', () => resetZoom(i-1));

    const img = document.createElement('a');
    img.className = 'nav-icon';
    img.title = 'Anomaly'

    const image = document.createElement('i');
    image.className = 'fa-solid fa-arrow-rotate-left'

    const canvas = document.createElement('canvas');
    canvas.id = `chart-${i}`;
    
    wrapper.appendChild(canvas);
    wrapper.appendChild(resetBtn);
    resetBtn.appendChild(image);
    container.appendChild(wrapper);
    
    const { labels, dataPoints, anomalyPoints } = generateChartData();
    
    const chart = new Chart(canvas, {
      type: 'line',
      data: {
          labels: labels,
          datasets: [
              {
                  label: 'Аномалии',
                  data: anomalyPoints.map(point => point ? point.y : null),
                  borderColor: 'transparent',
                  backgroundColor: 'red',
                  pointRadius: anomalyPoints.map(point => point ? 6 : 0),
                  pointHoverRadius: 10,
                  showLine: false
              },
              {
                  label: 'Активность',
                  data: dataPoints,
                  borderColor: '#0A1D3D',
                  backgroundColor: 'rgba(10, 29, 61, 0.1)',
                  borderWidth: 3,
                  tension: 0.5,
                  fill: true
              }
          ]
      },
      options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
              title: {
                  display: true,
                  text: `День 1`,
                  font: { size: 16 }
              },
              legend: { position: 'top' },
              tooltip: { mode: 'index', intersect: false }
          },
          scales: {
              x: {
              grid: {
                display: false,               
                },
              },
              y: { 
              beginAtZero: true,
              grid: {
                drawOnChartArea: true,
                drawTicks: false,
                display: true,
                borderDash: [7,7],
                lineWidth: 1,
                drawBorder: true,
              }
            }
          }
        }
      });

    // Добавляем обработчики для двойного клика
    canvas.addEventListener('dblclick', (e) => zoomChart(e, i-1));
    canvas.addEventListener('touchmove', (e) => zoomChart(e, i-1));

    charts.push({
      chart: chart,
      wrapper: wrapper,
      originalOptions: JSON.parse(JSON.stringify(chart.options)) // Сохраняем оригинальные настройки
    });
  }
}

// Увеличение графика
function zoomChart(e, index) {
  const chartObj = charts[index];
  const chart = chartObj.chart;
  const wrapper = chartObj.wrapper;

  // Увеличиваем
  wrapper.classList.add('zoomed');

  // Центрируем на точке клика
  if (e) {
    const canvas = chart.canvas;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const xValue = chart.scales.x.getValueForPixel(x);
    const yValue = chart.scales.y.getValueForPixel(y);
    
    const xRange = (chart.scales.x.max - chart.scales.x.min) / 2;
    const yRange = (chart.scales.y.max - chart.scales.y.min) / 2;
    
    chart.options.scales.x.min = xValue - xRange;
    chart.options.scales.x.max = xValue + xRange;
    chart.options.scales.y.min = yValue - yRange;
    chart.options.scales.y.max = yValue + yRange;
  }
  
  chart.update();
}

// Сброс масштаба
function resetZoom(index) {
  const chartObj = charts[index];
  chartObj.wrapper.classList.remove('zoomed');
  
  // Восстанавливаем оригинальные настройки
  chartObj.chart.options = JSON.parse(JSON.stringify(chartObj.originalOptions));
  chartObj.chart.update();
}

// Инициализация при загрузке
window.addEventListener('DOMContentLoaded', createCharts); 
