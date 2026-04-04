// views/mediaView.js

const renderMediaView = (fileUrls) => {
    const urls = Array.isArray(fileUrls) ? fileUrls : [fileUrls];
    const isPdf = urls[0].toLowerCase().endsWith('.pdf');
    
    // Mengambil nama file dari URL
    const fileName = urls[0].split('/').pop().split('?')[0] || "Dokumen PDF";
    
    const quotes = [
        "Semangat! Setiap langkah kecil membawamu ke tujuan besar.",
        "Jangan menyerah, hal-hal besar butuh waktu.",
        "Kamu melakukan pekerjaan yang luar biasa!",
        "Fokus pada proses, hasil akan mengikuti.",
        "Jadikan hari ini lebih baik dari kemarin.",
        "Disiplin adalah kunci kesuksesan.",
        "Percaya pada dirimu sendiri seperti Y.M.B percaya padamu.",
        "Tugas ini adalah investasi untuk masa depanmu.",
        "Istirahatlah jika lelah, tapi jangan berhenti.",
        "Kesalahan adalah bukti bahwa kamu sedang mencoba.",
        "Satu persen lebih baik setiap hari!",
        "Tetap tenang dan selesaikan tugasmu.",
        "Masa depan cerah menantimu di depan sana.",
        "Jangan bandingkan prosesmu dengan orang lain.",
        "Kamu lebih kuat dari tantangan yang kamu hadapi.",
        "Kerja keras hari ini, senyum manis hari esok.",
        "Bikin dirimu proud hari ini!",
        "Tidak ada kata terlambat untuk mulai belajar.",
        "Keberhasilan dimulai dari keputusan untuk mencoba.",
        "Y.M.B ASISTEN selalu mendukung setiap progresmu!"
    ];

    return `
    <!DOCTYPE html>
    <html lang="id">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-width=7.0, user-scalable=yes">
        <title>Y.M.B ASISTEN - Media View</title>
        <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swiper@11/swiper-bundle.min.css" />
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/animate.css/4.1.1/animate.min.css"/>
        <style>
            :root { --primary: #00a884; --bg: #0b141a; --card: #1f2c33; --danger: #ff4b4b; }
            
            #loading-overlay {
                position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
                background: var(--bg); display: flex; flex-direction: column;
                align-items: center; justify-content: center; z-index: 9999;
            }
            .spinner { width: 50px; height: 50px; border: 5px solid #2a3942; border-top: 5px solid var(--primary); border-radius: 50%; animation: spin 1s linear infinite; }
            @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }

            body { background: var(--bg); color: #e9edef; font-family: 'Segoe UI', sans-serif; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px; overflow-x: hidden; cursor: pointer; touch-action: manipulation; }
            
            .card-custom { background: var(--card); border: 1px solid #2a3942; border-radius: 30px; box-shadow: 0 25px 50px rgba(0,0,0,0.8); width: 100%; max-width: 800px; overflow: hidden; position: relative; pointer-events: auto; }
            
            .media-header { padding: 20px; text-align: center; border-bottom: 1px solid #2a3942; background: rgba(0,0,0,0.2); }
            .media-header h5 { color: var(--primary); font-weight: 800; letter-spacing: 2px; margin: 0; text-transform: uppercase; }
            
            /* PDF TITLE BOX */
            .pdf-name-tag {
                background: rgba(0, 168, 132, 0.15); color: #00e676; 
                padding: 10px 15px; border-radius: 12px; font-size: 0.85rem; 
                margin-bottom: 15px; display: inline-block; border: 1px solid var(--primary);
                word-break: break-all; max-width: 90%; font-weight: 600;
            }

            .media-content { padding: 20px; text-align: center; }
            .media-frame { border-radius: 15px; border: 2px solid var(--primary); box-shadow: 0 0 20px rgba(0,168,132,0.2); max-width: 100%; height: auto; max-height: 60vh; object-fit: contain; cursor: zoom-in; transition: transform 0.1s ease; background: #000; touch-action: none; }
            
            #error-box { display: none; padding: 30px; background: rgba(255, 75, 75, 0.1); border: 1px dashed var(--danger); border-radius: 25px; margin: 10px 0; }
            .btn-admin { background: var(--danger); color: white; border: none; padding: 12px 30px; border-radius: 50px; text-decoration: none; font-weight: bold; display: inline-flex; align-items: center; gap: 8px; margin-top: 15px; transition: 0.3s; box-shadow: 0 4px 15px rgba(255, 75, 75, 0.3); }

            .quote-container { margin: 15px 0; padding: 15px; background: rgba(0,168,132,0.1); border-radius: 15px; border-left: 4px solid var(--primary); }
            .quote-text { font-style: italic; font-size: 0.9rem; color: #d1d7db; }

            .btn-group-custom { display: flex; flex-direction: column; gap: 10px; align-items: center; margin-top: 15px; }
            
            .btn-download { 
                display: none; 
                background: linear-gradient(135deg, var(--primary), #06cf9c); color: white; border: none; padding: 14px 35px; border-radius: 50px; 
                font-weight: 800; text-decoration: none; align-items: center; gap: 10px;
                transition: 0.4s; box-shadow: 0 8px 20px rgba(0,168,132,0.3); animation: pulseCustom 2s infinite;
            }

            .btn-browser {
                background: transparent; color: #34b7f1; border: 1px solid #34b7f1; padding: 10px 25px; border-radius: 50px;
                text-decoration: none; font-size: 0.8rem; font-weight: 600; margin-bottom: 5px; transition: 0.3s;
            }
            .btn-browser:hover { background: rgba(52, 183, 241, 0.1); }
            
            .btn-fullscreen { background: transparent; color: var(--primary); border: 1px solid var(--primary); padding: 8px 20px; border-radius: 50px; font-size: 0.8rem; font-weight: 600; }

            @keyframes pulseCustom { 0% { box-shadow: 0 0 0 0 rgba(0,168,132,0.4); } 70% { box-shadow: 0 0 0 15px rgba(0,168,132,0); } 100% { box-shadow: 0 0 0 0 rgba(0,168,132,0); } }

            .footer-tag { font-size: 0.75rem; color: #8696a0; text-align: center; padding: 15px; border-top: 1px solid #2a3942; letter-spacing: 1px; }
            .zaki-name { color: var(--primary); font-weight: bold; }

            @media (min-width: 992px) { .card-custom { max-width: 900px; } .media-frame { max-height: 70vh; } }
        </style>
    </head>
    <body onclick="playQuoteVoice()">
        <div id="loading-overlay">
            <div class="spinner"></div>
            <div style="color:var(--primary); margin-top:15px; font-weight:bold;">MEMUAT MEDIA...</div>
        </div>

        <div class="card-custom animate__animated animate__zoomIn" onclick="event.stopPropagation(); playQuoteVoice();">
            <div class="media-header">
                <h5>📁 ${isPdf ? 'DOKUMEN FILE' : 'GALLERY VIEW'}</h5>
            </div>
            
            <div class="media-content">
                <div class="quote-container animate__animated animate__fadeIn">
                    <div class="quote-text" id="randomQuote"></div>
                </div>

                ${isPdf ? `<div class="pdf-name-tag animate__animated animate__fadeInDown">📄 ${fileName}</div>` : ''}

                <div id="error-box" class="animate__animated animate__headShake">
                    <div style="color: var(--danger); font-weight: 900; font-size: 1.2rem;">⚠️ FILE TIDAK DITEMUKAN</div>
                    <p style="color: #d1d7db; font-size: 0.85rem; margin-top: 10px;">
                        Maaf, file ini tidak bisa dibuka karena sudah dihapus oleh Admin atau terjadi gangguan pada server.
                    </p>
                    <a href="https://wa.me/6289531549103?text=Halo%20Admin,%20file%20media%20saya%20tidak%20bisa%20dibuka/error." class="btn-admin">
                        <span>📞 HUBUNGI ADMIN</span>
                    </a>
                </div>

                <div id="media-display-area">
                    ${isPdf ? 
                        `<iframe src="${urls[0]}" width="100%" height="500px" class="media-frame" onerror="showErrorView()"></iframe>` :
                        `<div class="swiper">
                            <div class="swiper-wrapper">
                                ${urls.map(url => `
                                    <div class="swiper-slide">
                                        <img src="${url}" class="media-frame img-fluid zoomable" alt="Tugas" onclick="toggleFullScreen(this)" onerror="showErrorView()">
                                    </div>
                                `).join('')}
                            </div>
                            <div class="swiper-pagination"></div>
                            <div class="swiper-button-prev"></div>
                            <div class="swiper-button-next"></div>
                        </div>`
                    }
                </div>

                <div class="btn-group-custom" id="action-buttons">
                    ${isPdf ? `<a href="${urls[0]}" target="_blank" class="btn-browser">🌐 BUKA DI TAB BARU</a>` : ''}
                    
                    ${!isPdf ? `<button class="btn-fullscreen" onclick="triggerFullScreen()">⛶ LIHAT FULL LAYAR</button>` : ''}
                    
                    <a href="${urls[0]}" id="downloadLink" download class="btn-download" onclick="event.stopPropagation(); playSuccessSound()">
                        <span>📥 DOWNLOAD FILE</span>
                    </a>
                </div>
            </div>

            <div class="footer-tag">
                LINK GENERATED BY <span class="zaki-name">Y.M.B ASISTEN</span>
            </div>
        </div>

        <script src="https://cdn.jsdelivr.net/npm/swiper@11/swiper-bundle.min.js"></script>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/hammer.js/2.0.8/hammer.min.js"></script>
        <script>
            function showErrorView() {
                document.getElementById('media-display-area').style.display = 'none';
                document.getElementById('action-buttons').style.display = 'none';
                document.getElementById('error-box').style.display = 'block';
                if ('speechSynthesis' in window) {
                    window.speechSynthesis.cancel();
                    window.speechSynthesis.speak(new SpeechSynthesisUtterance("Maaf kak, filenya tidak ditemukan. Silahkan hubungi admin ya."));
                }
            }

            async function registerOfflineWorker() {
                if ('serviceWorker' in navigator) {
                    const swCode = \`
                        const CACHE_NAME = 'ymb-v10';
                        self.addEventListener('install', e => self.skipWaiting());
                        self.addEventListener('activate', e => e.waitUntil(clients.claim()));
                        self.addEventListener('fetch', e => {
                            e.respondWith(
                                caches.match(e.request).then(res => res || fetch(e.request).then(netRes => {
                                    return caches.open(CACHE_NAME).then(cache => {
                                        cache.put(e.request, netRes.clone());
                                        return netRes;
                                    });
                                }))
                            );
                        });
                    \`;
                    const blob = new Blob([swCode], { type: 'text/javascript' });
                    const swUrl = URL.createObjectURL(blob);
                    navigator.serviceWorker.register(swUrl).catch(() => {});
                }
            }

            function updateOnlineStatus() {
                const dlBtn = document.getElementById('downloadLink');
                const qEl = document.getElementById('randomQuote');
                if (navigator.onLine) {
                    dlBtn.style.display = 'inline-flex';
                } else {
                    dlBtn.style.display = 'none';
                    if(qEl) {
                        qEl.innerText = "Mode Offline Aktif! File dari cache akan ditampilkan.";
                        qEl.style.color = "#ff9800";
                    }
                }
            }

            window.addEventListener('load', () => {
                registerOfflineWorker();
                updateOnlineStatus();
                if("${urls[0]}" === "" || "${urls[0]}" === "undefined") showErrorView();
                setTimeout(() => {
                    document.getElementById('loading-overlay').style.display = 'none';
                }, 1000);
            });

            window.addEventListener('online', updateOnlineStatus);
            window.addEventListener('offline', updateOnlineStatus);

            const quotes = ${JSON.stringify(quotes)};
            const qEl = document.getElementById('randomQuote');
            qEl.innerText = quotes[Math.floor(Math.random() * quotes.length)];

            function playQuoteVoice() {
                if ('speechSynthesis' in window) {
                    window.speechSynthesis.cancel();
                    const msg = new SpeechSynthesisUtterance(qEl.innerText);
                    msg.lang = 'id-ID';
                    window.speechSynthesis.speak(msg);
                }
            }

            function playSuccessSound() {
                if ('speechSynthesis' in window) {
                    window.speechSynthesis.speak(new SpeechSynthesisUtterance("Download dimulai, semangat ya kak!"));
                }
            }

            document.querySelectorAll('.zoomable').forEach(img => {
                const mc = new Hammer.Manager(img);
                mc.add(new Hammer.Pinch());
                let currentScale = 1;
                mc.on("pinchmove", (ev) => {
                    currentScale = Math.max(1, Math.min(ev.scale, 5));
                    img.style.transform = \`scale(\${currentScale})\`;
                });
                mc.on("pinchend", () => {
                    if(currentScale <= 1.1) img.style.transform = 'scale(1)';
                });
            });

            function triggerFullScreen() {
                const activeImg = document.querySelector('.swiper-slide-active img') || document.querySelector('.media-frame');
                if(activeImg) toggleFullScreen(activeImg);
            }

            function toggleFullScreen(element) {
                if (!document.fullscreenElement) {
                    element.requestFullscreen().catch(() => { 
                        element.style.transform = "scale(1.5)"; 
                    });
                } else {
                    document.exitFullscreen();
                    element.style.transform = "scale(1)";
                }
            }

            const swiper = new Swiper('.swiper', {
                grabCursor: true, centeredSlides: true,
                pagination: { el: '.swiper-pagination', clickable: true },
                navigation: { nextEl: '.swiper-button-next', prevEl: '.swiper-button-prev' },
                on: { slideChange: function () {
                    const img = this.slides[this.activeIndex].querySelector('img');
                    if (img) document.getElementById('downloadLink').href = img.src;
                }}
            });
        </script>
    </body>
    </html>`;
};

module.exports = { renderMediaView };
