// views/dashboard.js
const os = require("os");

const renderDashboard = (isConnected, qrCodeData, botConfig, stats, logs, port, profilePic) => {
    const usedRAM = ((os.totalmem() - os.freemem()) / (1024 ** 3)).toFixed(2);
    const uptime = (os.uptime() / 3600).toFixed(1);

    const moodEmojis = ["😅", "🤣", "😁", "😕", "🤫", "😆", "😗", "😂"];
    const randomMood = moodEmojis[Math.floor(Math.random() * moodEmojis.length)];

    const quotes = [
        "Tetap fokus, hasil tidak akan mengkhianati proses!",
        "Coding adalah seni, dan kamu adalah senimannya.",
        "Jangan berhenti saat lelah, berhentilah saat selesai.",
        "Error adalah cara kode mengatakan: 'Ajari aku lebih baik'.",
        "Jadikan hari ini lebih baik dari kemarin!",
        "Satu baris kode hari ini, satu langkah menuju sukses.",
        "Bekerja keraslah dalam diam, biarkan botmu yang berisik!"
    ];
    const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];

    // --- BAGIAN OTOMATISASI SYSTEM CONFIG ---
    const menuButtons = Object.keys(botConfig).map(key => {
        // Merapikan nama key (contoh: smartFeedback -> Smart Feedback)
        const formattedName = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
        return `
            <div class="col-6">
                <div class="stats-card">
                    <span style="font-size: 0.85rem; color: #8696a0;">${formattedName}</span><br>
                    <a href="/toggle/${key}">
                        <button class="btn btn-sm ${botConfig[key] ? 'btn-success' : 'btn-secondary'} w-100 mt-1" style="font-size: 0.7rem; font-weight: bold; border-radius: 10px;">
                            ${botConfig[key] ? 'ON' : 'OFF'}
                        </button>
                    </a>
                </div>
            </div>
        `;
    }).join('');

    const commonHead = `
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/animate.css/4.1.1/animate.min.css"/>
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
        <style>
            body { background: #0b141a; color: #e9edef; font-family: 'Segoe UI', sans-serif; overflow-x: hidden; }
            
            /* --- LOGIN STYLES --- */
            #loginScreen {
                position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                background: radial-gradient(circle, #121d23 0%, #0b141a 100%);
                z-index: 10000; display: flex; align-items: center; justify-content: center;
            }
            .login-box {
                background: #1f2c33; border: 1px solid #2a3942; border-radius: 40px;
                padding: 45px 35px; width: 90%; max-width: 420px; text-align: center;
                box-shadow: 0 30px 60px rgba(0,0,0,0.7); position: relative;
            }
            .login-avatar-area {
                width: 120px; height: 120px; margin: 0 auto 25px;
                position: relative; transition: 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                display: flex; align-items: center; justify-content: center;
                background: rgba(0, 168, 132, 0.1); border: 4px solid #00a884; border-radius: 50%;
                font-size: 65px; animation: moodSwing 5s infinite ease-in-out;
            }

            .input-container { position: relative; width: 100%; }
            .login-input {
                background: rgba(42, 57, 66, 0.5); border: 1px solid #3b4a54; color: white;
                border-radius: 18px; padding: 14px 20px; width: 100%; margin-bottom: 18px; 
                outline: none; transition: 0.3s; text-align: center;
            }
            .login-input:focus { border-color: #00a884; background: #2a3942; }

            .toggle-eye {
                position: absolute; right: 20px; top: 18px; color: #8696a0; cursor: pointer;
            }

            .login-btn {
                background: #00a884; color: white; border: none; width: 100%;
                padding: 14px; border-radius: 18px; font-weight: 800; 
                text-transform: uppercase; letter-spacing: 2px;
                transition: 0.4s; box-shadow: 0 10px 20px rgba(0, 168, 132, 0.3);
            }
            .login-btn:hover { background: #06cf9c; transform: translateY(-2px); }
            .login-btn:disabled { background: #3b4a54; color: #8696a0; cursor: not-allowed; }

            #loginStatus { font-weight: 900; font-size: 1.1rem; margin-bottom: 20px; display: none; }
            .status-error { color: #ff5252; }
            .status-success { color: #25d366; }

            @keyframes moodSwing {
                0% { transform: scale(1) rotate(0deg); }
                20% { transform: scale(1.1) rotate(-8deg); }
                40% { transform: translateX(-5px) rotate(0deg); }
                60% { transform: translateX(5px) rotate(0deg); }
                80% { transform: scale(1.1) rotate(8deg); }
                100% { transform: scale(1) rotate(0deg); }
            }

            /* --- DASHBOARD STYLES --- */
            .card-custom { background: #1f2c33; border: 1px solid #2a3942; border-radius: 30px; box-shadow: 0 25px 50px rgba(0,0,0,0.8); position: relative; overflow: hidden; }
            .mood-avatar { 
                font-size: 55px; width: 100px; height: 100px; 
                background: rgba(0, 168, 132, 0.1); border: 3px solid #00a884; border-radius: 50%;
                display: flex; align-items: center; justify-content: center; margin: 0 auto 12px;
                animation: moodSwing 5s infinite ease-in-out;
            }
            .quote-container { background: rgba(0, 168, 132, 0.08); border-left: 4px solid #00a884; padding: 15px; margin: 20px 0; border-radius: 15px; }
            .btn-neon-pill { background: rgba(0, 168, 132, 0.05); border: 2px solid #00a884; color: #00a884; padding: 8px 30px; border-radius: 50px; font-weight: 800; cursor: pointer; text-transform: uppercase; }
            .stats-card { background: #2a3942; border-radius: 18px; padding: 12px; text-align: center; }
            .log-box { background: #000; color: #00ff41 !important; border-radius: 18px; height: 180px; overflow-y: auto; padding: 15px; font-family: monospace; }
            .qr-container { background: white; padding: 15px; border-radius: 20px; display: inline-block; margin-bottom: 20px; }
            
            .logout-btn {
                background: transparent; border: 1px solid #ff5252; color: #ff5252;
                padding: 5px 15px; border-radius: 50px; font-size: 0.7rem; font-weight: bold;
                transition: 0.3s; margin-top: 10px; cursor: pointer;
            }
            .logout-btn:hover { background: #ff5252; color: white; }
        </style>
    `;

    if (isConnected) {
        return `
            <html>
                <head><title>Y.B.M ASISTEN</title>${commonHead}</head>
                <body class="py-4">
                    <div id="loginScreen">
                        <div class="login-box animate__animated animate__zoomIn">
                            <div id="avatarArea" class="login-avatar-area">
                                ${randomMood}
                            </div>
                            <h3 id="loginTitle" style="color:#fff; font-weight:900; letter-spacing:3px; margin-bottom:20px;">Y.B.M <span style="color:#00a884">ASISTEN</span></h3>
                            
                            <div id="loginStatus" class="animate__animated"></div>

                            <div id="loginFields">
                                <input type="text" id="username" class="login-input" placeholder="USERNAME">
                                <div class="input-container">
                                    <input type="password" id="password" class="login-input" placeholder="PASSWORD">
                                    <i class="fa-solid fa-eye-slash toggle-eye" onclick="togglePass()"></i>
                                </div>
                                <button id="submitBtn" onclick="attemptLogin()" class="login-btn">LOGIN</button>
                            </div>

                            <div id="loginLoading" style="display:none;" class="mt-3">
                                <div class="spinner-border text-success" role="status"></div>
                                <div class="mt-2 text-success fw-bold">AUTHENTICATING...</div>
                            </div>
                        </div>
                    </div>

                    <div id="mainContent" class="container" style="max-width: 480px; display:none;">
                        <div class="card-custom p-4">
                            <div class="text-center mb-4">
                                <div class="mood-avatar">${randomMood}</div>
                                <h4 style="color:#00a884; margin:0; font-weight:800; letter-spacing:2px;">Y.B.M <span style="color:#fff">ASISTEN</span></h4>
                                <div class="badge bg-success mt-2">● ENGINE ACTIVE</div>
                            </div>
                            <div class="quote-container">
                                <span class="quote-text" id="quoteText" style="font-style:italic; font-size:0.85rem;">"${randomQuote}"</span>
                            </div>
                            <div class="text-center mb-4">
                                <div id="mainBtn" class="btn-neon-pill" onclick="toggleMenu()">⚙️ SYSTEM CONFIG</div>
                            </div>
                            
                            <div id="layoutMenu" style="display:none;" class="row g-2 mb-3 animate__animated animate__fadeIn">
                                ${menuButtons}
                            </div>

                            <div class="row g-2 text-center mb-3">
                                <div class="col-3"><div class="stats-card"><small>RAM</small><br><b>${usedRAM}G</b></div></div>
                                <div class="col-3"><div class="stats-card"><small>UPTIME</small><br><b>${uptime}H</b></div></div>
                                <div class="col-3"><div class="stats-card"><small>CHAT</small><br><b>${stats.pesanMasuk}</b></div></div>
                                <div class="col-3"><div class="stats-card"><small>LOGS</small><br><b>${stats.totalLog}</b></div></div>
                            </div>
                            <div class="log-box" id="logBox">${logs.join('<br>')}</div>
                            <div class="text-center mt-4">
                                <div class="small text-muted">CORE OPERATED BY <span class="text-success fw-bold">ZAKI</span></div>
                                <button class="logout-btn" onclick="logoutSystem()"><i class="fa-solid fa-right-from-bracket"></i> KELUAR UNTU KEMBALI KE LOGIN</button>
                            </div>
                        </div>
                    </div>

                    <script>
                        let failedAttempts = 0;
                        let isCooldown = false;
                        const authChannel = new BroadcastChannel('auth_sync');

                        // --- AUTO LOGIN CHECK ---
                        window.onload = () => {
                            if(localStorage.getItem('zaki_auth') === 'true') {
                                showMainContent(true);
                                authChannel.postMessage({ type: 'LOGIN_NEW', id: Math.random() });
                            }
                        };

                        // --- SINGLE DEVICE KICK SYSTEM ---
                        authChannel.onmessage = (event) => {
                            if(event.data.type === 'LOGIN_NEW' && localStorage.getItem('zaki_auth') === 'true') {
                                speak("Peringatan. Perangkat lain mencoba masuk. Sesi ini dihentikan.");
                                alert("DIVACE LAIN MASUK! ANDA MENTAL!");
                                logoutSystem();
                            }
                        };

                        function togglePass() {
                            const p = document.getElementById('password');
                            const icon = event.target;
                            if(p.type === "password") {
                                p.type = "text";
                                icon.classList.replace('fa-eye-slash', 'fa-eye');
                            } else {
                                p.type = "password";
                                icon.classList.replace('fa-eye', 'fa-eye-slash');
                            }
                        }

                        function speak(msg) {
                            window.speechSynthesis.cancel();
                            const utterance = new SpeechSynthesisUtterance(msg);
                            utterance.lang = 'id-ID';
                            window.speechSynthesis.speak(utterance);
                        }

                        function attemptLogin() {
                            if(isCooldown) return;

                            const u = document.getElementById('username').value;
                            const p = document.getElementById('password').value;
                            const status = document.getElementById('loginStatus');
                            const fields = document.getElementById('loginFields');
                            const loader = document.getElementById('loginLoading');
                            const avatar = document.getElementById('avatarArea');
                            const box = document.querySelector('.login-box');

                            if(u === "ZAKI" && p === "ZAKI_DEVELOPER_BOT") {
                                localStorage.setItem('zaki_auth', 'true');
                                fields.style.display = "none";
                                loader.style.display = "block";
                                avatar.innerText = "😉";
                                
                                speak("Login sukses. Silakan masuk Zaki.");

                                setTimeout(() => {
                                    status.innerHTML = "ACCESS GRANTED!";
                                    status.className = "status-success animate__animated animate__pulse";
                                    status.style.display = "block";
                                    
                                    setTimeout(() => {
                                        box.classList.add('animate__animated', 'animate__zoomOut');
                                        setTimeout(() => {
                                            authChannel.postMessage({ type: 'LOGIN_NEW', id: Math.random() });
                                            showMainContent(false);
                                        }, 500);
                                    }, 1000);
                                }, 1500);
                            } else {
                                failedAttempts++;
                                avatar.innerText = "😡";
                                box.classList.add('animate__shakeX');
                                setTimeout(() => {
                                    box.classList.remove('animate__shakeX');
                                    if(!isCooldown) avatar.innerText = "${randomMood}";
                                }, 500);

                                if(failedAttempts >= 5) {
                                    startCooldown();
                                } else {
                                    status.innerHTML = "⚠️ KAMU BUKAN ZAKI! ("+failedAttempts+"/5)";
                                    status.className = "status-error animate__animated animate__shakeX";
                                    status.style.display = "block";
                                    speak("Akses ditolak.");
                                }
                            }
                        }

                        function showMainContent(isAuto) {
                            document.getElementById('loginScreen').style.display = "none";
                            const main = document.getElementById('mainContent');
                            main.style.display = "block";
                            main.classList.add('animate__animated', 'animate__fadeInUp');
                            if(!isAuto) speak("Sistem Y.B.M ASISTEN aktif. " + document.getElementById('quoteText').innerText);
                        }

                        function logoutSystem() {
                            localStorage.removeItem('zaki_auth');
                            location.reload();
                        }

                        function startCooldown() {
                            isCooldown = true;
                            let timeLeft = 20;
                            const status = document.getElementById('loginStatus');
                            const btn = document.getElementById('submitBtn');
                            const avatar = document.getElementById('avatarArea');

                            btn.disabled = true;
                            avatar.innerText = "🤫";
                            speak("Sistem dikunci 20 detik.");

                            const timer = setInterval(() => {
                                status.innerHTML = "CORE LOCKED! (" + timeLeft + "s)";
                                status.className = "status-error";
                                status.style.display = "block";
                                timeLeft--;

                                if(timeLeft < 0) {
                                    clearInterval(timer);
                                    isCooldown = false;
                                    failedAttempts = 0;
                                    btn.disabled = false;
                                    status.style.display = "none";
                                    avatar.innerText = "${randomMood}";
                                    speak("Sistem dibuka kembali.");
                                }
                            }, 1000);
                        }

                        function toggleMenu() {
                            const m = document.getElementById('layoutMenu');
                            m.style.display = m.style.display === 'none' ? 'flex' : 'none';
                        }
                    </script>
                </body>
            </html>
        `;
    }

    return `
        <html>
            <head><title>SCAN QR - Y.B.M ASISTEN</title>${commonHead}</head>
            <body class="vh-100 d-flex align-items-center justify-content-center">
                <div class="card-custom p-4 text-center animate__animated animate__fadeIn" style="max-width:400px;">
                    <h3 style="color:#00a884; font-weight:900;">SCAN <span style="color:#fff">QR CODE</span></h3>
                    <p class="small text-muted mb-4">Hubungkan WhatsApp kamu ke sistem</p>
                    <div class="qr-container">
                        ${qrCodeData ? `<img src="${qrCodeData}" width="250">` : `<div class="spinner-border text-success"></div><p class="mt-2 text-dark">Generating...</p>`}
                    </div>
                    <button class="btn btn-outline-light w-100 mt-3" onclick="location.reload()" style="border-radius:50px;">REFRESH PAGE</button>
                </div>
            </body>
        </html>
    `;
};

module.exports = { renderDashboard };
