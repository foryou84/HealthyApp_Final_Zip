(() => {
  const MEALS = ['בוקר', 'צהריים', 'ערב', 'ביניים'];
  let lastSignature = '';

  const num = value => {
    if (value === null || value === undefined || value === '') return 0;
    const n = Number(String(value).replace(',', '.'));
    return Number.isFinite(n) ? n : 0;
  };

  const pick = (...values) => {
    for (const value of values) {
      if (value !== undefined && value !== null && value !== '' && Number.isFinite(Number(String(value).replace(',', '.')))) return num(value);
    }
    return 0;
  };

  const fmt = (value, decimals = 1) => {
    const rounded = Math.round(num(value) * Math.pow(10, decimals)) / Math.pow(10, decimals);
    return rounded.toLocaleString('he-IL', { maximumFractionDigits: decimals });
  };

  const escapeHtml = value => String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;');

  // Replace the old on-screen keyboard with a real form input. Because the
  // input is created and focused inside the original user gesture, iOS Safari
  // opens its native keyboard instead of the app's simulated keyboard.
  window.openAppKeyboard = (title, value, type, onSave) => {
    document.getElementById('nativeEditOverlay')?.remove();
    const oldOverlay = document.getElementById('appKeyboard');
    if (oldOverlay) oldOverlay.classList.add('hide');

    const overlay = document.createElement('div');
    overlay.id = 'nativeEditOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:10000;background:#0008;display:flex;align-items:center;justify-content:center;padding:18px';
    const form = document.createElement('form');
    form.dir = 'rtl';
    form.style.cssText = 'width:min(100%,520px);background:#fff;border-radius:22px;padding:18px;box-shadow:0 20px 60px #0005';
    const heading = document.createElement('div');
    heading.textContent = title;
    heading.style.cssText = 'font-size:20px;font-weight:900;margin-bottom:12px';
    const input = document.createElement('input');
    input.value = String(value ?? '');
    input.type = type === 'number' ? 'text' : 'text';
    input.inputMode = type === 'number' ? 'decimal' : 'text';
    input.autocomplete = 'off';
    input.enterKeyHint = 'done';
    input.style.cssText = 'display:block;width:100%;box-sizing:border-box;font-size:22px;padding:13px;border:2px solid #93c5fd;border-radius:14px;background:#fff;color:#111827';
    const actions = document.createElement('div');
    actions.style.cssText = 'display:grid;grid-template-columns:1fr 2fr;gap:9px;margin-top:14px';
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.textContent = 'בטל';
    cancel.style.background = '#6b7280';
    const save = document.createElement('button');
    save.type = 'submit';
    save.textContent = 'אישור';
    actions.append(cancel, save);
    form.append(heading, input, actions);
    overlay.appendChild(form);
    document.body.appendChild(overlay);

    const close = () => overlay.remove();
    cancel.addEventListener('click', close);
    overlay.addEventListener('click', event => { if (event.target === overlay) close(); });
    form.addEventListener('submit', event => {
      event.preventDefault();
      const nextValue = input.value.trim();
      close();
      if (typeof onSave === 'function') onSave(nextValue);
    });

    input.focus({ preventScroll: true });
    input.select();
  };

  // iOS only opens its native keyboard when focus happens synchronously inside
  // the user's tap. Keep the in-app keyboard as a fallback, but restore a
  // direct native-keyboard path for normal text and numeric inputs.
  window.focusIphoneKeyboard = inputOrId => {
    const input = typeof inputOrId === 'string' ? document.getElementById(inputOrId) : inputOrId;
    if (!input) return;
    const overlay = document.getElementById('appKeyboard');
    if (overlay) overlay.classList.add('hide');
    input.focus();
    try {
      const end = String(input.value || '').length;
      input.setSelectionRange(end, end);
    } catch (_) {}
  };

  const prepareNativeTextControl = input => {
    if (!(input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement)) return;
    if (input instanceof HTMLInputElement && ['hidden', 'file', 'checkbox', 'radio', 'button', 'submit'].includes(input.type)) return;
    input.disabled = false;
    input.readOnly = false;
    if (!input.getAttribute('inputmode') || input.getAttribute('inputmode') === 'none') {
      const numeric = input instanceof HTMLInputElement && ['number', 'tel'].includes(input.type);
      input.setAttribute('inputmode', numeric ? 'decimal' : 'text');
    }
    input.style.fontSize = '16px';
    input.style.pointerEvents = 'auto';
    input.style.userSelect = 'text';
    input.style.webkitUserSelect = 'text';
    input.style.touchAction = 'manipulation';
    if (input.dataset.iosNativeKeyboardReady) return;
    input.dataset.iosNativeKeyboardReady = '1';
    input.addEventListener('touchstart', () => {
      // Run synchronously inside the user's touch. This also recovers the iOS
      // state where a caret is visible but the software keyboard stayed closed.
      input.readOnly = false;
      input.focus({ preventScroll: true });
    }, { passive: true });
  };

  const installGlobalIosKeyboardRecovery = () => {
    document.querySelectorAll('input,textarea').forEach(prepareNativeTextControl);
    if (window.__iosKeyboardObserver) return;
    window.__iosKeyboardObserver = new MutationObserver(records => {
      records.forEach(record => record.addedNodes.forEach(node => {
        if (!(node instanceof Element)) return;
        if (node.matches('input,textarea')) prepareNativeTextControl(node);
        node.querySelectorAll?.('input,textarea').forEach(prepareNativeTextControl);
      }));
    });
    window.__iosKeyboardObserver.observe(document.body, { childList: true, subtree: true });
  };

  const formatMealChatAnswer = text => String(text || '')
    .replace(/\s+(?=(?:ארוחת\s+)?(?:בוקר|צהריים|ערב|ביניים|נשנוש|סיכום)\s*:)/g, '\n')
    .replace(/^\s+|\s+$/g, '')
    .replace(/\n{3,}/g, '\n\n');

  window.addChat = (role, text) => {
    const bubble = document.createElement('div');
    bubble.className = `bubble ${role === 'user' ? 'userbubble' : 'aibubble'}`;
    bubble.textContent = role === 'user' ? String(text || '') : formatMealChatAnswer(text);
    bubble.style.whiteSpace = 'pre-wrap';
    bubble.style.overflowWrap = 'anywhere';
    chatLog.appendChild(bubble);
    chatLog.scrollTop = chatLog.scrollHeight;
  };

  window.askCoachChat = async () => {
    const question = chatInput.value.trim();
    if (!question) return;
    window.addChat('user', question);
    chatInput.value = '';
    try {
      const answer = await callGeminiText(`ענה בעברית קצרה ומעשית לפי הנתונים:\n${buildContext()}\nשאלה: ${question}\n\nכללי תצוגה מחייבים לתשובה על תפריט או הצעת אוכל:\nבוקר: שורה אחת\nצהריים: שורה אחת\nערב: שורה אחת\nביניים: שורה אחת\nסיכום: שורה אחת\nאין לכתוב את הארוחות כפסקה רציפה. כל ארוחה חייבת להתחיל בשורה חדשה.`);
      window.addChat('ai', answer);
    } catch (error) {
      window.addChat('ai', 'AI לא זמין: ' + error.message);
    }
  };

  let chatWeddingPhotos = [];
  let chatVoiceRecorder = null;
  let chatVoiceChunks = [];

  const renderChatPhotoPreview = () => {
    const box = document.getElementById('chatPhotoPreview');
    const analyze = document.getElementById('analyzeWeddingPhotos');
    const clear = document.getElementById('clearWeddingPhotos');
    if (!box) return;
    box.innerHTML = chatWeddingPhotos.map((src, index) => `<div style="position:relative"><img src="${src}" alt="תמונה ${index + 1}" style="width:100%;height:86px;object-fit:cover;border-radius:12px"><button type="button" data-photo-index="${index}" style="position:absolute;top:3px;left:3px;width:30px;height:30px;padding:0;margin:0;border-radius:50%;background:#ef4444">×</button></div>`).join('');
    box.classList.toggle('hide', !chatWeddingPhotos.length);
    if (analyze) {
      analyze.classList.toggle('hide', !chatWeddingPhotos.length);
      analyze.textContent = `🍽️ בדוק ${chatWeddingPhotos.length} תמונות עם Gemini ו-MABAT`;
    }
    if (clear) clear.classList.toggle('hide', !chatWeddingPhotos.length);
    box.querySelectorAll('[data-photo-index]').forEach(button => button.addEventListener('click', () => {
      chatWeddingPhotos.splice(Number(button.dataset.photoIndex), 1);
      renderChatPhotoPreview();
    }));
  };

  window.addChatWeddingPhotos = async event => {
    const files = [...(event.target.files || [])];
    event.target.value = '';
    if (!files.length) return;
    const remaining = Math.max(0, 6 - chatWeddingPhotos.length);
    if (!remaining) {
      window.addChat('ai', 'אפשר לבדוק עד 6 תמונות בכל פעם. בדוק או נקה את התמונות שכבר נבחרו.');
      return;
    }
    try {
      chatWeddingPhotos.push(...await Promise.all(files.slice(0, remaining).map(file => compressImage(file))));
      renderChatPhotoPreview();
      if (files.length > remaining) window.addChat('ai', `נבחרו ${remaining} תמונות בלבד. המגבלה היא 6 תמונות בכל בדיקה.`);
    } catch (error) {
      window.addChat('ai', 'לא הצלחתי לקרוא אחת התמונות: ' + error.message);
    }
  };

  const loadChatImage = src => new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });

  const createWeddingCollage = async images => {
    const loaded = await Promise.all(images.map(loadChatImage));
    const columns = images.length === 1 ? 1 : 2;
    const cellWidth = 360, cellHeight = 300;
    const canvas = document.createElement('canvas');
    canvas.width = cellWidth * columns;
    canvas.height = cellHeight * Math.ceil(images.length / columns);
    const context = canvas.getContext('2d');
    context.fillStyle = '#fff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    loaded.forEach((image, index) => {
      const x = index % columns * cellWidth, y = Math.floor(index / columns) * cellHeight;
      const scale = Math.max(cellWidth / image.width, cellHeight / image.height);
      const width = image.width * scale, height = image.height * scale;
      context.drawImage(image, x + (cellWidth - width) / 2, y + (cellHeight - height) / 2, width, height);
      context.fillStyle = '#007aff';
      context.beginPath(); context.arc(x + 25, y + 25, 18, 0, Math.PI * 2); context.fill();
      context.fillStyle = '#fff'; context.font = 'bold 20px sans-serif'; context.textAlign = 'center'; context.textBaseline = 'middle';
      context.fillText(String(index + 1), x + 25, y + 25);
    });
    return canvas.toDataURL('image/jpeg', .72);
  };

  window.clearWeddingPhotos = () => {
    chatWeddingPhotos = [];
    renderChatPhotoPreview();
  };

  window.analyzeWeddingPhotos = async () => {
    if (!chatWeddingPhotos.length) return;
    const button = document.getElementById('analyzeWeddingPhotos');
    const original = button.textContent;
    button.disabled = true;
    button.textContent = 'Gemini מזהה ואחר כך משווה ל-MABAT...';
    window.addChat('user', `שלחתי ${chatWeddingPhotos.length} תמונות מהאוכל בחתונה. בדוק עם Gemini ו-MABAT והצע מה וכמה לאכול.`);
    try {
      const collage = await createWeddingCollage(chatWeddingPhotos);
      const detected = await requestFoodAnalysis('זהה מכל התמונות הממוספרות את כל המאכלים הזמינים. אל תניח שנאכלו. אל תכלול אותו מאכל פעמיים. הערך כמות מנה רגילה לכל מאכל.', collage);
      const checked = detected.map(item => {
        const match = findMatches(item.name, 1)[0] || null;
        const amount = n(item.amount) || 100;
        const ai = { cal:n(item.cal), p:n(item.p), c:n(item.c), f:n(item.f) };
        const mabat = match ? foodActual(match, amount) : null;
        return { name:item.name, amount, ai, match, mabat };
      });
      const comparison = checked.map(item => item.match
        ? `${item.name}, מנה משוערת ${r(item.amount)} גרם | התאמת MABAT: ${item.match.name} | לכמות: ${r(item.mabat.cal)} קלוריות, חלבון ${r(item.mabat.p)}, פחמימה ${r(item.mabat.c)}, שומן ${r(item.mabat.f)} | Gemini: ${r(item.ai.cal)} קלוריות`
        : `${item.name}, מנה משוערת ${r(item.amount)} גרם | לא נמצאה התאמת MABAT | Gemini: ${r(item.ai.cal)} קלוריות, חלבון ${r(item.ai.p)}, פחמימה ${r(item.ai.c)}, שומן ${r(item.ai.f)}`
      ).join('\n');
      const answer = await callAiBackend(`Gemini זיהה מאכלים בתמונות ולאחר מכן בוצעה השוואה ל-MABAT. השתמש בערכי MABAT כשיש התאמה, וב-Gemini רק כשאין.\n${buildContext()}\n\nמאכלים והשוואה:\n${comparison}\n\nהצע מה וכמה לאכול בחתונה כדי לאזן מול מה שכבר נאכל והיעדים שנותרו. אל תניח שהמאכלים בתמונות כבר נאכלו.\nמבנה חובה, כל סעיף בשורה חדשה:\nזוהה בתמונות:\nמומלץ לבחור: ציין כל מאכל וכמות בגרם או ביחידות\nכדאי להגביל: ציין כמות מרבית\nעדיף להימנע: רק אם נחוץ\nסדר אכילה:\nסיכום משוער: קלוריות, חלבון, פחמימה ושומן\nמקור הערכים: ציין אילו נשענו על MABAT ואילו על Gemini\nהוסף משפט קצר שהזיהוי והכמויות מהצילום הם הערכה.`, null, 'gemini');
      window.addChat('ai', answer);
      window.clearWeddingPhotos();
    } catch (error) {
      window.addChat('ai', 'ניתוח התמונות נכשל: ' + error.message);
    } finally {
      button.disabled = false;
      button.textContent = original;
    }
  };

  const answerRecordedChat = async audioDataUrl => {
    window.addChat('user', '🎙️ שלחתי שאלה קולית');
    try {
      const answer = await callAiBackend(`האזן לשאלה בעברית וענה עליה בקצרה לפי הנתונים:\n${buildContext()}\nאם מדובר בהמלצת אוכל, השווה למאגר MABAT באמצעות הנתונים שכבר קיימים בהקשר וציין כמויות.`, audioDataUrl, 'gemini');
      window.addChat('ai', answer);
    } catch (error) {
      window.addChat('ai', 'פענוח ההקלטה נכשל: ' + error.message);
    }
  };

  window.recordChatQuestion = async () => {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const button = document.getElementById('chatRecordButton');
    if (Recognition) {
      const recognition = new Recognition();
      recognition.lang = 'he-IL'; recognition.interimResults = false;
      recognition.onstart = () => { button.textContent = '⏹️ מקשיב...'; button.style.background = '#ef4444'; };
      recognition.onresult = event => { chatInput.value = event.results[0][0].transcript; button.textContent = '🎙️ הקלט שאלה'; button.style.background = ''; window.askCoachChat(); };
      recognition.onerror = event => { button.textContent = '🎙️ הקלט שאלה'; button.style.background = ''; window.addChat('ai', 'הקול לא זוהה: ' + (event.error || 'שגיאה')); };
      recognition.onend = () => { if (button.textContent.includes('מקשיב')) { button.textContent = '🎙️ הקלט שאלה'; button.style.background = ''; } };
      try { recognition.start(); } catch (error) { window.addChat('ai', 'לא ניתן לפתוח מיקרופון: ' + error.message); }
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) { window.addChat('ai', 'הדפדפן אינו מאפשר הקלטה. פתח את האתר ב-Safari.'); return; }
    if (chatVoiceRecorder?.state === 'recording') { chatVoiceRecorder.stop(); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio:true });
      chatVoiceChunks = []; chatVoiceRecorder = new MediaRecorder(stream);
      chatVoiceRecorder.ondataavailable = event => { if (event.data.size) chatVoiceChunks.push(event.data); };
      chatVoiceRecorder.onstop = () => {
        stream.getTracks().forEach(track => track.stop()); button.textContent = '🎙️ הקלט שאלה'; button.style.background = '';
        const reader = new FileReader(); reader.onload = () => answerRecordedChat(reader.result);
        reader.readAsDataURL(new Blob(chatVoiceChunks, { type:chatVoiceRecorder.mimeType || 'audio/mp4' }));
      };
      chatVoiceRecorder.start(); button.textContent = '⏹️ סיום הקלטה'; button.style.background = '#ef4444';
    } catch (_) { window.addChat('ai', 'לא ניתנה גישה למיקרופון. אשר הרשאת מיקרופון ב-Safari ונסה שוב.'); }
  };

  const installChatMediaTools = () => {
    const input = document.getElementById('chatInput');
    if (!input || document.getElementById('chatMediaTools')) return;
    const mediaTools = document.createElement('div');
    mediaTools.id = 'chatMediaTools';
    mediaTools.innerHTML = `<div style="display:grid;grid-template-columns:1fr 1fr;gap:7px;margin:9px 0"><button type="button" id="chatRecordButton" onclick="recordChatQuestion()">🎙️ הקלט שאלה</button><button type="button" aria-label="צלם או בחר תמונות" onclick="document.getElementById('chatGalleryInput').click()">📷 צלם או בחר תמונות</button></div><input id="chatGalleryInput" type="file" accept="image/*" multiple class="hide" onchange="addChatWeddingPhotos(event)"><div id="chatPhotoPreview" class="hide" style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin:8px 0"></div><button type="button" id="analyzeWeddingPhotos" class="hide" onclick="analyzeWeddingPhotos()"></button><button type="button" id="clearWeddingPhotos" class="hide" style="background:#6b7280" onclick="clearWeddingPhotos()">נקה תמונות</button>`;
    input.insertAdjacentElement('afterend', mediaTools);
  };

  const installUnifiedPhotoPicker = () => {
    const cameraInput = document.getElementById('aiCamera');
    const galleryInput = document.getElementById('aiGallery');
    if (!cameraInput) return;
    cameraInput.removeAttribute('capture');
    cameraInput.setAttribute('accept', 'image/*');
    const quick = cameraInput.closest('.quick');
    const cameraButton = quick?.querySelector('button[onclick*="aiCamera"]');
    const galleryButton = quick?.querySelector('button[onclick*="aiGallery"]');
    if (cameraButton) {
      cameraButton.textContent = '📷';
      cameraButton.setAttribute('aria-label', 'צלם או בחר תמונה');
      cameraButton.title = 'צלם או בחר תמונה';
    }
    galleryButton?.remove();
    galleryInput?.remove();
  };

  const installNativeKeyboardControls = () => {
    const quickInput = document.getElementById('quick');
    const manualInput = document.getElementById('mName');
    [quickInput, manualInput].filter(Boolean).forEach(input => {
      input.type = 'text';
      input.disabled = false;
      input.readOnly = false;
      input.setAttribute('inputmode', 'text');
      input.setAttribute('autocomplete', 'off');
      input.setAttribute('enterkeyhint', 'done');
      input.style.fontSize = '16px';
      input.style.pointerEvents = 'auto';
      // Do not attach touch handlers here. Safari must receive the original tap
      // on the input itself in order to open the native iPhone keyboard.
    });
    if (quickInput && !document.getElementById('nativeQuickKeyboard')) {
      const button = document.createElement('button');
      button.id = 'nativeQuickKeyboard';
      button.type = 'button';
      button.textContent = '⌨️ הקלד במקלדת iPhone';
      button.style.cssText = 'margin-top:8px;background:#eef6ff;color:#1264c5';
      button.addEventListener('click', () => window.focusIphoneKeyboard(quickInput));
      quickInput.closest('.quick')?.insertAdjacentElement('afterend', button);
    }
    if (manualInput && !document.getElementById('nativeManualKeyboard')) {
      const button = document.createElement('button');
      button.id = 'nativeManualKeyboard';
      button.type = 'button';
      button.textContent = '⌨️ הקלד במקלדת iPhone';
      button.style.cssText = 'margin-top:6px;background:#eaf3ff;color:#1264c5';
      button.addEventListener('click', () => window.focusIphoneKeyboard(manualInput));
      manualInput.insertAdjacentElement('afterend', button);
      const fallback = manualInput.parentElement?.querySelector('button:not(#nativeManualKeyboard)');
      if (fallback) fallback.textContent = '✏️ ערוך שם במקלדת iPhone';
    }
  };

  // Strengthen MABAT matching for named food varieties. The main database uses
  // plural category forms such as "אגוזי לוז", while Gemini may return
  // "אגוז לוז". Without normalization a generic "אגוז מבושל" can win.
  if (typeof window.betterScoreFood === 'function' && !window.__specificFoodScoreFix) {
    const originalFoodScore = window.betterScoreFood;
    const cleanFoodText = value => String(value || '').toLowerCase()
      .replace(/["׳״'`.,:;!?()\[\]{}\/\\_-]/g, ' ').replace(/\s+/g, ' ').trim();
    const foodToken = word => ({ אגוזי: 'אגוז', אגוזים: 'אגוז', שקדים: 'שקד', בוטנים: 'בוטן' }[word] || word);
    window.betterScoreFood = function specificFoodScore(query, food) {
      const baseScore = originalFoodScore(query, food);
      if (baseScore < 0 || !food) return baseScore;
      const cleanQuery = cleanFoodText(query);
      const queryWords = cleanQuery.split(/\s+/).filter(Boolean).map(foodToken);
      const names = [food.name, ...(food.a || [])].map(cleanFoodText);
      const nameWords = names.flatMap(name => name.split(/\s+/).filter(Boolean).map(foodToken));
      const matched = queryWords.filter(word => nameWords.includes(word));
      const normalizedExtra = Math.max(0, matched.length - Math.floor(baseScore / 350)) * 350;
      const varietyBonus = queryWords.slice(1).filter(word => nameWords.includes(word)).length * 500;
      // Prefer the food itself ("ריבה, כל הטעמים") over a compound product
      // that merely contains it ("עוגיות במילוי ריבה").
      const leadingFoodBonus = names.some(name => name === cleanQuery || name.startsWith(cleanQuery + ' ')) ? 1500 : 0;
      return baseScore + normalizedExtra + varietyBonus + leadingFoodBonus;
    };
    window.__specificFoodScoreFix = true;
  }

  // Let the user choose the exact MABAT record for every Gemini result instead
  // of silently accepting the first automatic match.
  if (typeof window.renderAiComparison === 'function' && !window.__mabatChoiceList) {
    // A preparation bonus (for example "מבושל") may only reorder genuine text
    // matches. It must never introduce unrelated cooked foods into the list.
    const coreClean = value => String(value || '').toLowerCase()
      .replace(/["׳״'`.,:;!?()\[\]{}\/\\_-]/g, ' ').replace(/\s+/g, ' ').trim();
    const coreFoodToken = word => ({ אגוזי: 'אגוז', אגוזים: 'אגוז', שקדים: 'שקד', בוטנים: 'בוטן' }[word] || word);
    const preparationWords = new Set(['עם','בלי','ללא','של','או','ו','מבושל','מבושלים','מבושלת','מבושלות','מוכן','מוכנים','מוכנה','טרי','טריים','טריה','טריות','מטוגן','מטוגנים','מטוגנת','אפוי','אפויים','אפויה','מאודה','מאודים','מאודה','במים','מים','בשמן','שמן','מלח','קפוא','קפואים','קפואה','מסונן','מסוננת','אחוז','אחוזים']);
    const percentValue = value => {
      const text = String(value || '').toLowerCase();
      const match = text.match(/(\d+(?:[.,]\d+)?)\s*(?:%|אחוז(?:ים)?)/);
      return match ? Number(match[1].replace(',', '.')) : null;
    };
    const relevantToken = word => {
      const normalized = coreClean(word);
      if (preparationWords.has(normalized) || /^\d/.test(normalized)) return '';
      if (normalized.length > 4 && normalized.endsWith('ים')) return normalized.slice(0, -2);
      return coreFoodToken(normalized);
    };
    const hasCoreFoodMatch = (query, food) => {
      const queryTokens = [...new Set(coreClean(query).split(/\s+/).map(relevantToken).filter(Boolean))];
      if (!queryTokens.length) return false;
      const foodTokens = new Set(coreClean([food.name, ...(food.a || [])].join(' ')).split(/\s+/).map(relevantToken).filter(Boolean));
      const matchedCoreWords = queryTokens.filter(token => foodTokens.has(token)).length;
      const requiredCoreWords = Math.min(2, queryTokens.length);
      return matchedCoreWords >= requiredCoreWords;
    };
    window.findMatches = function relevantMabatMatches(query, limit = 50) {
      const requestedPercent = percentValue(query);
      return allFoods().map(food => {
        const lexical = betterScoreFood(query, food);
        const coreMatch = hasCoreFoodMatch(query, food);
        const foodPercent = percentValue([food.name, ...(food.a || [])].join(' '));
        const percentBonus = requestedPercent == null ? 0 : (foodPercent === requestedPercent ? 2500 : (foodPercent == null ? 0 : -1200));
        return { food, lexical, coreMatch, score: coreMatch && lexical > 0 ? lexical + defaultReadyFoodBonus(query, food) + percentBonus : lexical };
      }).filter(result => result.lexical > 0 && result.coreMatch)
        .sort((a, b) => b.score - a.score).slice(0, limit).map(result => result.food);
    };
    window.findFood = function relevantMabatFood(query) {
      return window.findMatches(query, 1)[0] || null;
    };
    const originalRenderAiComparison = window.renderAiComparison;
    const ensureMabatMatches = item => {
      if (!Array.isArray(item.mabatMatches)) item.mabatMatches = typeof findMatches === 'function' ? findMatches(item.aiName, 50) : [];
      if (!item.mabat && item.mabatMatches.length) item.mabat = item.mabatMatches[0];
      return item.mabatMatches;
    };
    window.selectMabatMatch = (foodIndex, matchIndex) => {
      const item = pendingAiFoods[Number(foodIndex)];
      if (!item) return;
      const selected = ensureMabatMatches(item)[Number(matchIndex)];
      if (!selected) return;
      item.mabat = selected;
      item.choice = 'mabat';
      window.renderAiComparison();
    };
    window.renderAiComparison = function renderComparisonWithMabatChoices() {
      try { pendingAiFoods.forEach(ensureMabatMatches); } catch (_) {}
      originalRenderAiComparison();
      const cards = document.querySelectorAll('#aiEditBox .compare-card');
      cards.forEach((card, foodIndex) => {
        const item = pendingAiFoods[foodIndex];
        if (!item) return;
        if (item.mabat) {
          const sourceLabel = [...card.querySelectorAll('label')].find(node => node.textContent.includes('מקור הערכים'));
          const sourceSelect = sourceLabel?.nextElementSibling;
          sourceSelect?.querySelector('option[value="gemini"]')?.remove();
          const tableHeaders = card.querySelectorAll('.compare-table th');
          if (tableHeaders[1]) tableHeaders[1].textContent = 'Gemini - הערכה בלבד';
        }
        if (card.querySelector('.mabat-match-picker')) return;
        const matches = ensureMabatMatches(item);
        const wrapper = document.createElement('div');
        wrapper.className = 'mabat-match-picker';
        const label = document.createElement('label');
        label.textContent = matches.length ? `בחר התאמה מדויקת מתוך MABAT (${matches.length} אפשרויות)` : 'לא נמצאו התאמות ב־MABAT';
        wrapper.appendChild(label);
        if (matches.length) {
          const select = document.createElement('select');
          matches.forEach((food, matchIndex) => {
            const text = `${food.name} | ${fmt(food.cal)} קל׳, חלבון ${fmt(food.p)}, פחמימה ${fmt(food.c)}, שומן ${fmt(food.f)} ל־100`;
            select.add(new Option(text, String(matchIndex), false, food === item.mabat));
          });
          select.addEventListener('change', () => window.selectMabatMatch(foodIndex, select.value));
          wrapper.appendChild(select);
          const badge = card.querySelector('.compare-source');
          if (badge) badge.textContent = 'נמצאו התאמות MABAT לבחירה';
        }
        const sourceLabel = [...card.querySelectorAll('label')].find(node => node.textContent.includes('מקור הערכים'));
        card.insertBefore(wrapper, sourceLabel || card.querySelector('.compare-table'));
      });
    };
    window.__mabatChoiceList = true;
  }

  // Gemini identifies the dish and estimates its quantity. Whenever MABAT has
  // a relevant match, MABAT is the default nutrition source, even when an old
  // Gemini-derived value was approved in a previous session.
  if (typeof window.prepareAiComparison === 'function' && !window.__mabatFirstComparison) {
    const originalPrepareAiComparison = window.prepareAiComparison;
    window.prepareAiComparison = function prepareMabatFirst(items, photo = '') {
      originalPrepareAiComparison(items, photo);
      try {
        pendingAiFoods.forEach(item => {
          if (!Array.isArray(item.mabatMatches)) item.mabatMatches = typeof findMatches === 'function' ? findMatches(item.aiName, 50) : [];
          if (!item.mabat && item.mabatMatches.length) item.mabat = item.mabatMatches[0];
          if (item.mabat) item.choice = 'mabat';
          else if (item.approved) item.choice = 'approved';
          else item.choice = 'gemini';
        });
        window.renderAiComparison();
        const intro = document.querySelector('#aiEditBox > .small');
        if (intro) intro.textContent = 'Gemini מזהה את המאכל והכמות. הערכים התזונתיים נלקחים מ-MABAT כשיש התאמה. בחר את פריט MABAT המדויק ורק אז אשר.';
      } catch (_) {}
    };
    window.__mabatFirstComparison = true;
  }

  const normalizeMeal = value => {
    const raw = String(value || '').trim().toLowerCase();
    if (!raw) return 'ביניים';
    if (raw.includes('בוקר') || raw === 'breakfast') return 'בוקר';
    if (raw.includes('צהר') || raw === 'lunch') return 'צהריים';
    if (raw.includes('ערב') || raw === 'dinner') return 'ערב';
    if (raw.includes('ביניים') || raw.includes('נשנ') || raw.includes('חטיף') || raw === 'snack') return 'ביניים';
    return MEALS.includes(value) ? value : 'ביניים';
  };

  const nutrition = entry => ({
    cal: pick(entry.cal, entry.kcal, entry.calories, entry.energy),
    p: pick(entry.p, entry.protein, entry.proteinG),
    c: pick(entry.c, entry.carbs, entry.carb, entry.carbohydrates),
    f: pick(entry.f, entry.fat, entry.fatG),
    v: pick(entry.v, entry.veg, entry.vegetables, entry.vegetable, entry.vegG)
  });

  const sumEntries = entries => (entries || []).reduce((sum, entry) => {
    const n = nutrition(entry || {});
    sum.cal += n.cal; sum.p += n.p; sum.c += n.c; sum.f += n.f; sum.v += n.v;
    return sum;
  }, { cal: 0, p: 0, c: 0, f: 0, v: 0 });

  const getTarget = state => {
    const t = state.targets || state.target || state.goals || {};
    return {
      cal: pick(t.calories, t.cal, t.kcal, t.energy, state.targetCalories, state.calorieTarget, state.kcalTarget, state.dailyCalories),
      p: pick(t.protein, t.p, t.proteinG, state.targetProtein, state.proteinTarget, state.dailyProtein),
      c: pick(t.carbs, t.c, t.carb, t.carbohydrates, state.targetCarbs, state.carbTarget, state.dailyCarbs),
      f: pick(t.fat, t.f, t.fatG, state.targetFat, state.fatTarget, state.dailyFat),
      v: pick(t.veg, t.v, t.vegetables, t.vegG, state.targetVeg, state.vegTarget, state.dailyVeg, 500)
    };
  };

  function getState() {
    try { if (typeof st !== 'undefined' && st) return st; } catch (_) {}
    return window.st || null;
  }

  function sameEntriesShape(candidate, state) {
    if (!candidate || !Array.isArray(candidate.entries) || !state || !Array.isArray(state.entries)) return false;
    if (candidate.entries.length !== state.entries.length) return false;
    if (!candidate.entries.length) return true;
    const getName = e => String((e && (e.name || e.food || e.title)) || '');
    return getName(candidate.entries[0]) === getName(state.entries[0]) &&
      getName(candidate.entries[candidate.entries.length - 1]) === getName(state.entries[state.entries.length - 1]);
  }

  function persistToStorage(storage, state) {
    if (!storage) return false;
    try {
      for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i);
        const raw = storage.getItem(key);
        if (!raw) continue;
        let data;
        try { data = JSON.parse(raw); } catch (_) { continue; }
        if (sameEntriesShape(data, state)) {
          storage.setItem(key, JSON.stringify(state));
          return true;
        }
        for (const wrapper of ['state', 'st', 'data', 'appState']) {
          if (data && sameEntriesShape(data[wrapper], state)) {
            data[wrapper] = state;
            storage.setItem(key, JSON.stringify(data));
            return true;
          }
        }
      }
    } catch (_) {}
    return false;
  }

  function persistState(state, previousEntries) {
    let saved = false;
    const snapshot = Array.isArray(previousEntries) ? previousEntries : null;

    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        let data;
        try { data = JSON.parse(raw); } catch (_) { continue; }
        const candidates = [{root:data, wrapper:null}, ...['state','st','data','appState'].map(wrapper => ({root:data && data[wrapper], wrapper}))];
        for (const candidate of candidates) {
          const obj = candidate.root;
          if (!obj || !Array.isArray(obj.entries)) continue;
          const oldState = { entries: snapshot || state.entries };
          if (!sameEntriesShape(obj, oldState)) continue;
          if (candidate.wrapper) {
            data[candidate.wrapper] = state;
            localStorage.setItem(key, JSON.stringify(data));
          } else {
            localStorage.setItem(key, JSON.stringify(state));
          }
          saved = true;
          break;
        }
        if (saved) break;
      }
    } catch (_) {}

    if (!saved) saved = persistToStorage(window.sessionStorage, state);

    for (const fnName of ['saveState', 'persistState', 'saveData', 'saveAppState', 'commitState']) {
      const fn = window[fnName];
      if (typeof fn === 'function') {
        try { fn(); saved = true; break; } catch (_) {}
      }
    }

    try {
      window.dispatchEvent(new CustomEvent('healthyapp:statechange', { detail: { source: 'meal-editor' } }));
    } catch (_) {}
    return saved;
  }

  const valueCell = (value, decimals = 1) => `<td>${fmt(value, decimals)}</td>`;

  const detailHtml = items => {
    if (!items.length) return '<div class="meal-summary-empty">אין פריטים בארוחה זו.</div>';
    return items.map(({ entry, index }) => {
      const n = nutrition(entry || {});
      const amount = pick(entry.amount, entry.qty, entry.quantity, entry.grams, entry.weight);
      const amountText = amount ? `${fmt(amount)} ${escapeHtml(entry.unit || 'ג׳')}` : '';
      const name = escapeHtml(entry.name || entry.food || 'פריט');
      return `<div class="meal-summary-item">
        <div class="meal-summary-item-top"><b>${name}</b>${amountText ? `<span>${amountText}</span>` : ''}</div>
        <div class="meal-summary-item-macros">${fmt(n.cal,0)} קל׳ | חלבון ${fmt(n.p)} | פחמימה ${fmt(n.c)} | שומן ${fmt(n.f)}${n.v ? ` | ירקות ${fmt(n.v)} ג׳` : ''}</div>
        <div class="meal-summary-actions">
          <button type="button" class="meal-edit-btn" onclick="event.stopPropagation();editMealEntry(${index})">✏️ ערוך כמות</button>
          <button type="button" class="meal-delete-btn" onclick="event.stopPropagation();deleteMealEntry(${index})">🗑️ מחק</button>
        </div>
      </div>`;
    }).join('');
  };

  window.toggleMealSummaryDetail = id => {
    const row = document.getElementById(id);
    if (row) row.classList.toggle('hide');
  };

  function quantityKey(entry) {
    return ['amount','qty','quantity','grams','weight'].find(key => entry && entry[key] !== undefined && entry[key] !== null && entry[key] !== '') || 'amount';
  }

  function scaleExistingNutrition(entry, ratio) {
    if (!Number.isFinite(ratio)) return;
    const keys = ['cal','kcal','calories','energy','p','protein','proteinG','c','carbs','carb','carbohydrates','f','fat','fatG','v','veg','vegetables','vegetable','vegG'];
    keys.forEach(key => {
      if (entry[key] !== undefined && entry[key] !== null && entry[key] !== '' && Number.isFinite(num(entry[key]))) {
        entry[key] = Math.round(num(entry[key]) * ratio * 100) / 100;
      }
    });
  }

  window.deleteMealEntry = index => {
    const state = getState();
    if (!state || !Array.isArray(state.entries) || !state.entries[index]) return;
    const entry = state.entries[index];
    const name = entry.name || entry.food || 'המאכל';
    if (!window.confirm(`למחוק את "${name}" מהיום?`)) return;
    const previousEntries = state.entries.map(item => ({ ...item }));
    state.entries.splice(index, 1);
    persistState(state, previousEntries);
    lastSignature = '';
    renderMealJournalTable(true);
  };

  window.editMealEntry = index => {
    const state = getState();
    if (!state || !Array.isArray(state.entries) || !state.entries[index]) return;
    const entry = state.entries[index];
    const key = quantityKey(entry);
    const current = pick(entry[key]);
    const name = entry.name || entry.food || 'המאכל';

    if (!current) {
      alert(`ל-${name} אין כמות שמורה שאפשר לשנות אוטומטית. אם לא אכלת אותו, השתמש בכפתור מחק.`);
      return;
    }

    const applyValue = answer => {
      const next = num(answer);
      if (!(next > 0)) {
        if (next === 0 && window.confirm('כמות 0 תמחק את המאכל. למחוק?')) window.deleteMealEntry(index);
        else if (next !== 0) alert('יש להזין כמות גדולה מ-0.');
        return;
      }
      const previousEntries = state.entries.map(item => ({ ...item }));
      const ratio = next / current;
      entry[key] = next;
      scaleExistingNutrition(entry, ratio);
      persistState(state, previousEntries);
      lastSignature = '';
      renderMealJournalTable(true);
    };
    if (typeof window.openAppKeyboard === 'function') window.openAppKeyboard(`כמות חדשה עבור ${name}`, String(current), 'number', applyValue);
    else {
      const answer = window.prompt(`כמות חדשה עבור ${name}:`, String(current));
      if (answer !== null) applyValue(answer);
    }
  };

  function renderMealJournalTable(force = false) {
    const box = document.getElementById('mealJournal');
    const state = getState();
    if (!box || !state) return;

    const entries = Array.isArray(state.entries) ? state.entries : [];
    const target = getTarget(state);
    const signature = JSON.stringify([entries, target]);
    if (!force && signature === lastSignature && box.querySelector('.meal-summary-table')) return;
    lastSignature = signature;

    const indexed = entries.map((entry, index) => ({ entry, index }));
    const rows = MEALS.map(meal => {
      const items = indexed.filter(({entry}) => normalizeMeal(entry && (entry.meal ?? entry.mealType ?? entry.mealName ?? entry.category)) === meal);
      return { meal, items, total: sumEntries(items.map(item => item.entry)) };
    });

    const total = sumEntries(entries);
    const remaining = {
      cal: Math.max(0, target.cal - total.cal),
      p: Math.max(0, target.p - total.p),
      c: Math.max(0, target.c - total.c),
      f: Math.max(0, target.f - total.f),
      v: Math.max(0, target.v - total.v)
    };

    const summaryRow = (label, values, className) => `<tr class="${className}"><th scope="row">${label}</th>${valueCell(values.cal,0)}${valueCell(values.p)}${valueCell(values.c)}${valueCell(values.f)}${valueCell(values.v)}</tr>`;

    const mealRows = rows.map((row, index) => {
      const id = `mealSummaryDetail${index}`;
      return `<tr class="meal-summary-meal-row" onclick="toggleMealSummaryDetail('${id}')"><th scope="row">${row.meal}<span>⌄</span></th>${valueCell(row.total.cal,0)}${valueCell(row.total.p)}${valueCell(row.total.c)}${valueCell(row.total.f)}${valueCell(row.total.v)}</tr><tr id="${id}" class="meal-summary-detail hide"><td colspan="6">${detailHtml(row.items)}</td></tr>`;
    }).join('');

    box.innerHTML = `<div class="meal-summary-scroll"><table class="meal-summary-table" dir="rtl"><thead><tr><th>ארוחה</th><th>קלוריות</th><th>חלבון</th><th>פחמימה</th><th>שומן</th><th>ירקות</th></tr></thead><tbody>${mealRows}${summaryRow('סה״כ היום',total,'meal-summary-total')}${summaryRow('יעד יומי',target,'meal-summary-target')}${summaryRow('נשאר',remaining,'meal-summary-remaining')}</tbody></table></div><div class="meal-summary-hint">לחץ על ארוחה לפירוט. ליד כל מאכל אפשר לערוך כמות או למחוק.</div>`;
  }

  window.renderMealJournal = () => renderMealJournalTable(true);

  function installManualConversionLayout() {
    const amount = document.getElementById('mAmount');
    const unit = document.getElementById('mUnit');
    const name = document.getElementById('mName');
    const gramFactor = document.getElementById('mGramPerUnit');
    const nutrients = document.querySelector('.manual-nutrients');
    if (!amount || !unit || !name || !gramFactor || document.getElementById('manualQuantityRow')) return;

    const manualTop = amount.closest('.manual-top') || amount.parentElement?.parentElement;
    const amountWrap = amount.parentElement;
    const unitWrap = unit.parentElement;
    if (!manualTop || !amountWrap || !unitWrap) return;

    const cupOption = [...unit.options].find(option => option.value === 'cup');
    if (cupOption) cupOption.textContent = 'כוס מדידה 240 מ״ל';
    if (![...unit.options].some(option => option.value === 'cup180')) {
      const cup180 = new Option('כוס שתייה מים 180 מ״ל', 'cup180');
      unit.add(cup180, cupOption ? cupOption.index + 1 : undefined);
    }

    const row = document.createElement('div');
    row.id = 'manualQuantityRow';
    const conversionWrap = document.createElement('div');
    conversionWrap.className = 'manual-conversion-wrap';
    conversionWrap.innerHTML = '<label>המרה</label><output id="manualConversionDisplay" aria-live="polite">—</output>';
    row.append(amountWrap, unitWrap, conversionWrap);
    manualTop.appendChild(row);

    // Keep the original per-unit factor for the existing nutrition calculation,
    // but replace its editable field with a clear two-way conversion display.
    const oldFactorWrap = gramFactor.parentElement;
    if (oldFactorWrap) oldFactorWrap.style.display = 'none';

    if (nutrients && !document.getElementById('manualNutrientsAdvanced')) {
      const details = document.createElement('details');
      details.id = 'manualNutrientsAdvanced';
      const summary = document.createElement('summary');
      summary.textContent = 'ערכים תזונתיים ל־100 — מתקדם';
      nutrients.parentNode.insertBefore(details, nutrients);
      details.append(summary, nutrients);
    }

    const rememberedFactors = {};
    const foodForName = () => {
      try {
        if (typeof findFood === 'function') return findFood(name.value);
        if (typeof findMatches === 'function') return findMatches(name.value, 1)?.[0] || null;
      } catch (_) {}
      return null;
    };
    const fallbackFactor = selectedUnit => ({ tbsp: 15, tsp: 5, cup: 240, cup180: 180, unit: 1 })[selectedUnit] || 1;
    const factorFor = selectedUnit => {
      const lookupUnit = selectedUnit === 'cup180' ? 'cup' : selectedUnit;
      const portionNames = { cup: ['כוס'], tbsp: ['כף'], tsp: ['כפית'], unit: ['יחידה'] }[lookupUnit] || [];
      let food = foodForName();
      try {
        const candidates = typeof findMatches === 'function' ? findMatches(name.value, 50) : [];
        const exactMabatPortion = candidates.find(candidate => candidate?.src === 'MABAT' && Object.keys(candidate.portions || {}).some(key => portionNames.includes(key)));
        if (exactMabatPortion) food = exactMabatPortion;
      } catch (_) {}
      let factor = 0;
      try {
        if (food && typeof portionWeightForFood === 'function') {
          factor = selectedUnit === 'cup180'
            ? num(portionWeightForFood(food, 'cup')) * (180 / 240)
            : num(portionWeightForFood(food, selectedUnit));
        }
      } catch (_) {}
      if (!factor && rememberedFactors[selectedUnit]) factor = rememberedFactors[selectedUnit];
      if (!factor && selectedUnit === unit.value && unit.value !== 'g') factor = num(gramFactor.value);
      factor = factor || fallbackFactor(selectedUnit);
      rememberedFactors[selectedUnit] = factor;
      return factor;
    };
    const displayNumber = value => fmt(value, Number.isInteger(num(value)) ? 0 : 1);
    const syncConversion = () => {
      const output = document.getElementById('manualConversionDisplay');
      if (!output) return;
      const quantity = num(amount.value);
      if (!(quantity > 0)) { output.textContent = '—'; return; }
      if (unit.value === 'g') {
        const tbsp = factorFor('tbsp') || 15;
        output.textContent = `${displayNumber(quantity / tbsp)} כפות`;
        output.title = `לפי ${displayNumber(tbsp)} גרם לכף עבור המאכל הנבחר`;
      } else {
        const factor = factorFor(unit.value);
        gramFactor.value = factor;
        output.textContent = `${displayNumber(quantity * factor)} גרם/מ״ל`;
        output.title = `לפי ${displayNumber(factor)} גרם/מ״ל ליחידה עבור המאכל הנבחר`;
      }
    };

    amount.addEventListener('input', syncConversion);
    unit.addEventListener('change', () => { syncConversion(); try { window.manualPreview?.(); } catch (_) {} });
    name.addEventListener('input', syncConversion);
    name.addEventListener('change', syncConversion);
    gramFactor.addEventListener('input', () => {
      if (unit.value !== 'g' && num(gramFactor.value) > 0) rememberedFactors[unit.value] = num(gramFactor.value);
      syncConversion();
    });
    setInterval(syncConversion, 1200);
    syncConversion();
  }

  if (!document.getElementById('meal-summary-table-style-v3')) {
    const style = document.createElement('style');
    style.id = 'meal-summary-table-style-v3';
    style.textContent = `
      #mealJournal{direction:rtl}
      .meal-summary-scroll{margin-top:10px;overflow-x:auto;-webkit-overflow-scrolling:touch;border:1px solid #e5e7eb;border-radius:18px;background:#fff}
      .meal-summary-table{width:100%;min-width:520px;border-collapse:collapse;direction:rtl;table-layout:fixed;background:#fff;font-size:12px}
      .meal-summary-table th,.meal-summary-table td{padding:10px 5px;text-align:center;white-space:nowrap;border-bottom:1px solid #e5e7eb}
      .meal-summary-table thead th{background:#f8fafc;font-weight:900;color:#374151}
      .meal-summary-table th:first-child{width:20%;text-align:right;font-weight:900;position:sticky;right:0;z-index:2;background:#fff}
      .meal-summary-table thead th:first-child{background:#f8fafc;z-index:3}
      .meal-summary-meal-row{cursor:pointer}
      .meal-summary-meal-row th{display:flex;align-items:center;justify-content:space-between;gap:4px}
      .meal-summary-detail td{padding:0!important;text-align:right!important;background:#fbfdff}
      .meal-summary-item{padding:10px 12px;border-bottom:1px solid #eef2f7;white-space:normal}
      .meal-summary-item-top{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}
      .meal-summary-item-top b{white-space:normal;line-height:1.35}
      .meal-summary-item span,.meal-summary-item-macros,.meal-summary-empty{font-size:11px;color:#6b7280}
      .meal-summary-item-macros{margin-top:4px;white-space:normal;line-height:1.45}.meal-summary-empty{padding:12px;text-align:center}
      .meal-summary-actions{display:flex;gap:8px;margin-top:8px}
      .meal-summary-actions button{border:0;border-radius:10px;padding:7px 10px;font-size:11px;font-weight:800;cursor:pointer}
      .meal-edit-btn{background:#eaf3ff;color:#1264c5}.meal-delete-btn{background:#fff0f0;color:#b42318}
      .meal-summary-total th,.meal-summary-total td{font-weight:900;background:#eef6ff}.meal-summary-total th:first-child{background:#eef6ff}
      .meal-summary-target th,.meal-summary-target td{font-weight:900;background:#f5f3ff}.meal-summary-target th:first-child{background:#f5f3ff}
      .meal-summary-remaining th,.meal-summary-remaining td{font-weight:900;background:#ecfdf5;border-bottom:0}.meal-summary-remaining th:first-child{background:#ecfdf5}
      .meal-summary-hint{font-size:11px;color:#6b7280;text-align:center;margin-top:7px}
      @media(max-width:520px){.meal-summary-table{min-width:500px;font-size:11px}.meal-summary-table th,.meal-summary-table td{padding:9px 4px}}
      #manualQuantityRow{grid-column:1/-1;display:grid;grid-template-columns:1fr 1fr 1.15fr;gap:8px;align-items:end}
      #manualQuantityRow>div{min-width:0}#manualQuantityRow label{display:block}
      #manualConversionDisplay{display:flex;align-items:center;justify-content:center;box-sizing:border-box;width:100%;min-height:48px;padding:10px 6px;border:1px solid #d9dee8;border-radius:14px;background:#eef6ff;color:#075fb5;font-size:17px;font-weight:900;white-space:nowrap}
      #manualNutrientsAdvanced{margin-top:10px;border:1px solid #dce7f5;border-radius:14px;background:#f8fbff;padding:0 10px 10px}
      #manualNutrientsAdvanced>summary{cursor:pointer;padding:11px 3px 1px;color:#586579;font-weight:800;font-size:13px}
      #manualNutrientsAdvanced:not([open]){padding-bottom:0}#manualNutrientsAdvanced .manual-nutrients{margin-top:9px}
      @media(max-width:520px){#manualQuantityRow{grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}#manualQuantityRow input,#manualQuantityRow select{padding-left:5px!important;padding-right:5px!important;font-size:16px!important}#manualConversionDisplay{font-size:14px;min-height:46px;padding:8px 3px}}
    `;
    document.head.appendChild(style);
  }

  const refresh = force => { try { renderMealJournalTable(!!force); } catch (e) { console.error('meal summary render failed', e); } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(() => { installGlobalIosKeyboardRecovery(); installNativeKeyboardControls(); installUnifiedPhotoPicker(); installChatMediaTools(); installManualConversionLayout(); refresh(true); }, 50));
  else setTimeout(() => { installGlobalIosKeyboardRecovery(); installNativeKeyboardControls(); installUnifiedPhotoPicker(); installChatMediaTools(); installManualConversionLayout(); refresh(true); }, 50);

  document.addEventListener('click', () => setTimeout(() => refresh(false), 250), true);
  document.addEventListener('change', () => setTimeout(() => refresh(false), 150), true);
  window.addEventListener('focus', () => refresh(false));
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(false); });
  setInterval(() => refresh(false), 900);
})();
