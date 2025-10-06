document.addEventListener('DOMContentLoaded', function() {
            const ovalToggle = document.getElementById('ovalToggle');
            const statusText = document.getElementById('statusText');
            const toggleKnob = document.querySelector('.toggle-knob');
            let isActive = false;

            function toggleButton() {
                isActive = !isActive;
                                
                if (isActive) {
                    // Включение
                    ovalToggle.classList.add('active');
                    toggleKnob.textContent = 'ON';
                    statusText.textContent = 'Подключение...';
                    
                    // Плавное изменение статуса
                    setTimeout(() => {
                        statusText.textContent = 'Устройство подключено!';
                    }, 1500);
                    
                } else {
                    // Выключение
                    ovalToggle.classList.remove('active');
                    toggleKnob.textContent = 'OFF';
                    statusText.textContent = 'Отключено';
                }
            }

            // Обработчик клика
            ovalToggle.addEventListener('click', function() {
                toggleButton();
            });
        });
        