import React, { useEffect, useRef } from 'react';
import { Chart } from 'chart.js/auto';

const ChartsComponent = () => {
  const charts = useRef([]);
  const containerRef = useRef(null);
  const isInitialized = useRef(false);

  // Генерация случайных данных
  const generateChartData = () => {
    const labels = [];
    const dataPoints = [];
    const anomalyPoints = [];
    
    for (let i = 0; i < 30; i++) {
      labels.push(`${i}`);
      let value;
      
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
  };

  // Создание графиков
  const createCharts = () => {
    const container = containerRef.current;

    // Очищаем контейнер перед созданием новых графиков
    container.innerHTML = '';

      const wrapper = document.createElement('div');
      wrapper.className = 'chart-wrapper';
      wrapper.id = `wrapper-1`;
      
      // Добавляем кнопку сброса
      const resetBtn = document.createElement('button');
      resetBtn.className = 'reset-btn';
      resetBtn.addEventListener('click', () => resetZoom(1));

      // Создаем контейнер для иконки
      const iconContainer = document.createElement('div');
      iconContainer.className = 'anomaly-icon';
      
      // Добавляем иконку FaFire через DOM
      const iconSvg = document.createElement('div');
      iconSvg.innerHTML =  `<svg width="20" viewBox="0 0 512 512" style = "margin-top: 3px">
                        <path fill="currentColor" d="M256 504C119 504 8 393 8 256S119 8 256 8s248 111 248 248-111 248-248 248zm116-292H256v-70.9c0-10.7-13-16.1-20.5-8.5L121.2 247.5c-4.7 4.7-4.7 12.2 0 16.9l114.3 114.9c7.6 7.6 20.5 2.2 20.5-8.5V300h116c6.6 0 12-5.4 12-12v-64c0-6.6-5.4-12-12-12z"/>
                    </svg>`;
      
      const canvas = document.createElement('canvas');
      canvas.id = `chart-1`;
      // Добавляем стили для растягивания canvas
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      
      wrapper.appendChild(canvas);
      wrapper.appendChild(iconContainer);
      resetBtn.appendChild(iconSvg.cloneNode(true));
      wrapper.appendChild(resetBtn);
      container.appendChild(wrapper);

      const { labels, dataPoints, anomalyPoints } = generateChartData();
      
      const chart = new Chart(canvas, {
            type: 'line',
            data: {
              labels: labels,
              datasets: [
                  {
                    label: 'Aктивность',
                    data: dataPoints,
                    borderColor: '#000000ff',
                    borderWidth: 6,
                    backgroundColor: "rgba(0, 0, 0, 0)",
                    pointBackgroundColor: '#ffffff',
                    pointBorderColor: '#000000ff',
                    pointBorderWidth: 3,
                    pointRadius: 4,
                    pointHoverRadius: 10,
                    fill: true,
                    tension: 0.4,
                    pointHoverBorderWidth: 4,
                  },
                  {
                    data: anomalyPoints.map(point => point ? point.y : null),
                    borderColor: '#000000ff',
                    borderWidth: 6,
                    backgroundColor: "rgba(255, 0, 0, 0)",
                    pointBackgroundColor: '#ffffff',
                    pointBorderColor: '#c80000ff',
                    pointBorderWidth: 3,
                    pointRadius: 16,
                    pointHoverRadius: 10,
                    fill: true,
                    tension: 0.4,
                    pointHoverBorderWidth: 4,
                    showLine: false
                  }
                ],
            },
            options: {
              responsive: true,
              maintainAspectRatio: false, // Изменили на false
              plugins: {
                title: {
                  display: true,
                  text: `месяц`,
                  font: { size: 20 }
                },
                legend: {
                  display: false
                },
                tooltip: {
                  backgroundColor: '#1a1a1a',
                  titleColor: '#ffffff',
                  bodyColor: '#ffffff',
                  borderColor: '#333',
                  borderWidth: 1,
                  padding: 12,
                  cornerRadius: 8,
                  displayColors: false,
                }
              },
              scales: {
                y: {
                  beginAtZero: false,
                  grid: {
                    color: 'rgba(0, 0, 0, 0.03)',
                    drawBorder: false
                  },
                  ticks: {
                    color: '#000',
                    font: {
                      size: 11,
                      weight: '500'
                    },
                  }
                },
                x: {
                  grid: {
                    color: 'rgba(0, 0, 0, 0.03)',
                    drawBorder: false
                  },
                  ticks: {
                    color: '#000',
                    font: {
                      size: 11,
                      weight: '500'
                    }
                  }
                }
              },
              interaction: {
                intersect: false,
                mode: 'index',
              },
              animations: {
                tension: {
                  duration: 1000,
                  easing: 'easeOutCubic',
                }
              }
          }
      });

      // Добавляем обработчики для двойного клика
      const handleDoubleClick = (e) => zoomChart(e, 1);
      const handleTouchMove = (e) => zoomChart(e, 1);

      canvas.addEventListener('dblclick', handleDoubleClick);
      canvas.addEventListener('touchmove', handleTouchMove);

      charts.current.push({
        chart: chart,
        wrapper: wrapper,
        originalOptions: JSON.parse(JSON.stringify(chart.options)),
        handlers: {
          dblclick: handleDoubleClick,
          touchmove: handleTouchMove
        }
    });
  };


  // Увеличение графика
  const zoomChart = (e, index) => {
    const chartObj = charts.current[index];
    if (!chartObj) return;

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
  };

  // Сброс масштаба
  const resetZoom = (index) => {
    const chartObj = charts.current[index];
    if (!chartObj) return;

    chartObj.wrapper.classList.remove('zoomed');
    
    // Восстанавливаем оригинальные настройки
    chartObj.chart.options = JSON.parse(JSON.stringify(chartObj.originalOptions));
    chartObj.chart.update();
  };

  useEffect(() => {
    createCharts();
  });

  return (
        <div id="charts-container" ref={containerRef}/>
  );
};

export default ChartsComponent;
