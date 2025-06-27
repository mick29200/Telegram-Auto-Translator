// ==UserScript==
// @name         Telegram Auto Translator – Google Translate Web avec choix langue et rafraîchissement
// @namespace    http://tampermonkey.net/
// @version      0.1
// @author       Michel Laurence (Nascheka)
// @description  Traduction live des messages Telegram avec choix langue et réactualisation complète à chaque changement de langue.
// @match        https://web.telegram.org/a/*
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  // --- Création panneau latéral ---
  const panel = document.createElement('div');
  panel.style.position = 'fixed';
  panel.style.top = '60px';
  panel.style.right = '0';
  panel.style.width = 'min(30vw, 400px)';
  panel.style.maxHeight = '80vh';
  panel.style.overflowY = 'auto';
  panel.style.backgroundColor = 'rgba(250, 250, 250, 0.95)';
  panel.style.borderLeft = '1px solid #ccc';
  panel.style.padding = '10px';
  panel.style.zIndex = '9999';
  panel.style.fontFamily = 'Arial, sans-serif';
  panel.style.fontSize = '12px';
  panel.style.pointerEvents = 'auto';
  document.body.appendChild(panel);

  // --- Titre ---
  const title = document.createElement('h3');
  title.style.marginTop = '0';
  title.textContent = '🌍 Traduction en direct';
  panel.appendChild(title);

  // --- Sélecteur langue ---
  const langSelector = document.createElement('select');
  langSelector.style.marginBottom = '10px';
  langSelector.style.width = '100%';

  const LANGUAGES = {
    'af': 'Afrikaans',
    'sq': 'Albanais',
    'ar': 'Arabe',
    'hy': 'Arménien',
    'az': 'Azéri',
    'eu': 'Basque',
    'be': 'Biélorusse',
    'bn': 'Bengali',
    'bg': 'Bulgare',
    'ca': 'Catalan',
    'zh-CN': 'Chinois simplifié',
    'zh-TW': 'Chinois traditionnel',
    'hr': 'Croate',
    'cs': 'Tchèque',
    'da': 'Danois',
    'nl': 'Néerlandais',
    'en': 'Anglais',
    'eo': 'Espéranto',
    'et': 'Estonien',
    'fi': 'Finnois',
    'fr': 'Français',
    'gl': 'Galicien',
    'ka': 'Géorgien',
    'de': 'Allemand',
    'el': 'Grec',
    'gu': 'Gujarati',
    'ht': 'Haïtien',
    'he': 'Hébreu',
    'hi': 'Hindi',
    'hu': 'Hongrois',
    'is': 'Islandais',
    'id': 'Indonésien',
    'ga': 'Irlandais',
    'it': 'Italien',
    'ja': 'Japonais',
    'kn': 'Kannada',
    'ko': 'Coréen',
    'lv': 'Letton',
    'lt': 'Lituanien',
    'mk': 'Macédonien',
    'ms': 'Malais',
    'mt': 'Maltais',
    'mr': 'Marathi',
    'no': 'Norvégien',
    'pl': 'Polonais',
    'pt': 'Portugais',
    'ro': 'Roumain',
    'ru': 'Russe',
    'sr': 'Serbe',
    'sk': 'Slovaque',
    'sl': 'Slovène',
    'es': 'Espagnol',
    'sw': 'Swahili',
    'sv': 'Suédois',
    'ta': 'Tamoul',
    'te': 'Télougou',
    'th': 'Thaï',
    'tr': 'Turc',
    'uk': 'Ukrainien',
    'ur': 'Ourdou',
    'vi': 'Vietnamien',
    'cy': 'Gallois',
  };

  for (const [code, name] of Object.entries(LANGUAGES)) {
    const option = document.createElement('option');
    option.value = code;
    option.textContent = name;
    langSelector.appendChild(option);
  }
  panel.appendChild(langSelector);

  // --- Container messages traduits ---
  const messagesContainer = document.createElement('div');
  panel.appendChild(messagesContainer);

  // --- Variables ---
  let processedIds = new Set();
  let messagesCache = new Map(); // id -> texte original, pour relancer traduction
  const queue = [];
  let translating = false;
  let currentChatTitle = null;
  let minMessageId = null;

  // --- Pré-sélection langue selon navigateur ---
  const userLang = navigator.language.slice(0, 2).toLowerCase();
  if (LANGUAGES[userLang]) {
    langSelector.value = userLang;
  } else {
    langSelector.value = 'fr'; // fallback
  }

  // --- Fonction traduction Google Translate web ---
  async function translate(text, targetLang) {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Erreur traduction');
    const data = await res.json();
    return data[0].map(x => x[0]).join('');
  }

  // --- Ajout message dans panneau ---
  function addMessage(id, original, translation) {
    if (document.querySelector(`[data-msgid="${id}"]`)) return;

    const msgDiv = document.createElement('div');
    msgDiv.style.borderBottom = '1px solid #ddd';
    msgDiv.style.padding = '6px 0';
    msgDiv.setAttribute('data-msgid', id);

    const origDiv = document.createElement('div');
    origDiv.style.color = '#444';
    origDiv.textContent = '📝 ' + original;

    const transDiv = document.createElement('div');
    transDiv.style.color = '#2e7d32';
    transDiv.style.fontWeight = 'bold';
    transDiv.style.marginTop = '2px';
    transDiv.textContent = translation;

    msgDiv.appendChild(origDiv);
    msgDiv.appendChild(transDiv);
    messagesContainer.appendChild(msgDiv);

    panel.scrollTop = panel.scrollHeight;
  }

  // --- Traitement file ---
  async function processQueue() {
    if (translating) return;
    translating = true;

    while (queue.length > 0) {
      const { id, originalText } = queue.shift();

      addMessage(id, originalText, '➡️ traduction en cours...');

      try {
        const translated = await translate(originalText, langSelector.value);
        const old = document.querySelector(`[data-msgid="${id}"]`);
        if (old) messagesContainer.removeChild(old);
        addMessage(id, originalText, '➡️ ' + translated);
      } catch (e) {
        const old = document.querySelector(`[data-msgid="${id}"]`);
        if (old) messagesContainer.removeChild(old);
        addMessage(id, originalText, '❌ erreur de traduction');
      }
    }

    translating = false;
  }

  // --- Détection messages Telegram ---
  function detectMessages() {
    const msgs = document.querySelectorAll('[data-message-id]');
    for (const msg of msgs) {
      const id = msg.getAttribute('data-message-id');
      if (!id || processedIds.has(id)) continue;
      if (minMessageId && parseInt(id) <= parseInt(minMessageId)) continue;

      const textEl = msg.querySelector('[dir="auto"]');
      if (!textEl) continue;
      const originalText = textEl.innerText.trim();
      if (!originalText) continue;

      processedIds.add(id);
      messagesCache.set(id, originalText);
      queue.push({ id, originalText });
    }
    if (queue.length > 0) processQueue();
  }

  // --- Observer chat ---
  const mainContainer = document.querySelector('main');
  if (mainContainer) {
    const observer = new MutationObserver(() => {
      detectMessages();
    });
    observer.observe(mainContainer, { childList: true, subtree: true });
  }

  // --- Reset si changement chat ---
  function resetForNewChat(newTitle) {
    currentChatTitle = newTitle;
    messagesContainer.innerHTML = '';
    processedIds.clear();
    queue.length = 0;
    messagesCache.clear();
    translating = false;

    const lastMsgs = Array.from(document.querySelectorAll('[data-message-id]'));
    if (lastMsgs.length > 0) {
      const lastId = lastMsgs[lastMsgs.length - 1].getAttribute('data-message-id');
      minMessageId = lastId;
      console.log(`📌 Nouveau chat détecté : "${currentChatTitle}", minMessageId = ${minMessageId}`);
    }
  }

  setInterval(() => {
    const chatTitleEl = document.querySelector('header h3 span');
    if (!chatTitleEl) return;

    const newTitle = chatTitleEl.textContent.trim();
    if (newTitle && newTitle !== currentChatTitle) {
      resetForNewChat(newTitle);
      detectMessages();
    }
  }, 1000);

  setInterval(detectMessages, 1500);

  // --- Rafraîchir la traduction lors du changement de langue ---
  langSelector.addEventListener('change', () => {
    // Vider l'affichage
    messagesContainer.innerHTML = '';
    queue.length = 0;
    translating = false;

    // Remettre tous les messages dans la file avec le nouveau choix de langue
    for (const [id, originalText] of messagesCache.entries()) {
      queue.push({ id, originalText });
    }

    processQueue();
  });

})();
