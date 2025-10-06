let array = []

for (var i = 1; i <=7; i++) {
    let test = {
        text : 'Скачок напряжения',
        num: `Сегодня, 14:32:4${i}`,
        value: `21${i} B`,
    }
    array.push(test)
}

function update() {
    if (array.length === 0) {
        const container = document.getElementById('anomalies-list');

        const h = document.createElement('h3');
        h.textContent = 'Последние аномалии';

        container.appendChild(h);

        const main = document.createElement('div');
        main.className = 'anomaly-item';

        const wrapper = document.createElement('div');
        wrapper.className = 'anomaly-details';

        const text = document.createElement('div');
        text.className = 'no-text';
        text.textContent = 'Событий нет';

        main.appendChild(wrapper);
        wrapper.appendChild(text);
        container.appendChild(main);
    }

    else {
        const container = document.getElementById('anomalies-list');
        container.innerHTML = '';

        const h = document.createElement('h3');
        h.textContent = 'Последние аномалии';

        container.appendChild(h);

        for (let i = 0; i <= 4; i++) {
            const main = document.createElement('div');
            main.className = 'anomaly-item';
            
            const two = document.createElement('div');
            two.className = 'anomaly-icon warning';
    
            const info = document.createElement('i');
            info.className = 'fas fa-bolt';

            const it = document.createElement('div');
            it.className = 'anomaly-details';
    
            const info_two = document.createElement('div');
            info_two.className = 'anomaly-type';
            info_two.textContent = `${array[i].text}`;
            
            const info_three = document.createElement('div');
            info_three.className = 'anomaly-time';
            info_three.textContent = `${array[i].num}`;
            
            const anomal = document.createElement('div');
            anomal.className = 'anomaly-value critical-value';
            anomal.textContent = `${array[i].value}`;
            
            main.appendChild(two);
            two.appendChild(info);
            main.appendChild(it)
            it.appendChild(info_two);
            it.appendChild(info_three);
            main.appendChild(anomal);
            container.appendChild(main);
        }
    }
}

function reload() {
if (array.length > 5) {
    array.splice(0, 1);
    update();
    console.log("Массив:", array);
    console.log("Длина массива:", array.length);
    }
}

function updateVoltage() {
  const voltageElement = document.querySelector('.status-card .status-value');
  const fluctuation = (Math.random() * 2 - 1).toFixed(1);
  const newVoltage = (219.8 + parseFloat(fluctuation)).toFixed(1);
  voltageElement.textContent = `${newVoltage} B`;
  
  if (newVoltage > 220 || newVoltage < 190) {
      voltageElement.style.color = 'var(--danger)';
  } else if (newVoltage > 225 || newVoltage < 210) {
      voltageElement.style.color = 'var(--warning)';
  } else {
      voltageElement.style.color = 'inherit';
  }
}

window.addEventListener('DOMContentLoaded', update);

setInterval(updateVoltage, 3000);
setInterval(reload,100)
