/*!
 * biryuzik.js — гуляющий питомец-маскот (V0), движок mascot-engine
 * Vanilla, без зависимостей. Один скрипт-тег.
 * (c) Denis Onosov (ODV999) · PRIVATE
 *
 * Использование:
 *   <script src="biryuzik.js"></script>
 *   <script>Biryuzik.init({ lang:'ru' })</script>
 */
(function (global) {
  'use strict';

  var VERSION = '1.1.9';
  var reduceMotion = false;
  try {
    reduceMotion = global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch (e) {}

  // Имя питомца берётся из pack.json, а не зашивается. Раньше ЛЮБОЙ скин представлялся
  // Бирюзиком: на витрине лис здоровался «Hi! I am Biryuzik», и то же имя стояло в aria-label
  // у всех одиннадцати карточек — для незрячего пользователя вся колода была одним животным.
  var DEFAULT_NAME = { ru: 'Бирюзик', en: 'Biryuzik' };

  function linesFor(lang, name) {
    var who = name || DEFAULT_NAME[lang] || DEFAULT_NAME.en;
    return lang === 'ru'
      ? ['Привет! Я ' + who + ' 👋', 'Гуляю тут…', 'Нажми — покажу фокус ✨', 'Чем помочь?', 'Я всегда рядом ⚡']
      : ['Hi! I am ' + who + ' 👋', 'Just strolling…', 'Tap me — I have a trick ✨', 'Need help?', 'Always here ⚡'];
  }

  var LINES = { ru: linesFor('ru'), en: linesFor('en') };

  // реплики от потребностей: голод / усталость / скука
  var NEEDS = {
    ru: { hungry: ['Есть хочу 🍜', 'Урчит в животе…'], tired: ['Глаза слипаются 😴', 'Я вымотался…'], sad: ['Скучно 😔', 'Погладь меня?'] },
    en: { hungry: ['I am hungry 🍜', 'Tummy rumbling…'], tired: ['So sleepy 😴', 'I am worn out…'], sad: ['I am bored 😔', 'Pet me?'] }
  };

  // реестр живых питомцев: нужен, чтобы они видели друг друга (встречи, группировка)
  var PETS = [];

  var uidCounter = 0;
  function uid() { uidCounter += 1; return 'bz' + uidCounter + Math.random().toString(36).slice(2, 6); }

  // ── Разметка персонажа. ВАЖНО: все id градиентов/фильтров уникальны на инстанс,
  // иначе два маскота на странице перекрашивают друг друга через url(#).
  function characterSVG(ns) {
    var g = function (name) { return name + '-' + ns; };
    return '' +
    '<svg class="bz-char" viewBox="0 0 300 300" role="img" aria-label="Бирюзик">' +
      '<defs>' +
        '<radialGradient id="' + g('body') + '" cx="34%" cy="22%" r="82%"><stop offset="0" stop-color="#fbf9ff"/><stop offset=".28" stop-color="#d9d1ff"/><stop offset=".67" stop-color="#9a7cff"/><stop offset="1" stop-color="#6541d9"/></radialGradient>' +
        '<linearGradient id="' + g('deep') + '" x1=".12" y1=".08" x2=".92" y2=".9"><stop stop-color="#a78cff"/><stop offset="1" stop-color="#5934c7"/></linearGradient>' +
        '<linearGradient id="' + g('ear') + '" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#8a68df"/><stop offset="1" stop-color="#4b277f"/></linearGradient>' +
        '<radialGradient id="' + g('iris') + '" cx="35%" cy="25%" r="75%"><stop stop-color="#7664d9"/><stop offset=".52" stop-color="#332066"/><stop offset="1" stop-color="#120d24"/></radialGradient>' +
        '<radialGradient id="' + g('syn') + '" cx="38%" cy="32%" r="70%"><stop stop-color="#edfff9"/><stop offset=".36" stop-color="#83f5d0"/><stop offset="1" stop-color="#32ba93"/></radialGradient>' +
        '<filter id="' + g('shadow') + '" x="-50%" y="-50%" width="200%" height="220%"><feDropShadow dx="0" dy="10" stdDeviation="8" flood-color="#321a72" flood-opacity=".24"/></filter>' +
        '<filter id="' + g('glow') + '" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>' +
      '</defs>' +
      '<g class="bz-tail" filter="url(#' + g('shadow') + ')">' +
        '<path d="M213 222c48 25 76-5 62-42-7-19-30-21-38-3-5 11 2 23 14 21" fill="none" stroke="#4e2d9d" stroke-width="24" stroke-linecap="round"/>' +
        '<path d="M213 219c42 21 65-3 54-33" fill="none" stroke="url(#' + g('deep') + ')" stroke-width="16" stroke-linecap="round"/>' +
        '<circle cx="253" cy="180" r="13" fill="url(#' + g('syn') + ')" stroke="#ecfff8" stroke-width="3" filter="url(#' + g('glow') + ')"/>' +
      '</g>' +
      '<g filter="url(#' + g('shadow') + ')">' +
        '<path d="M76 108 44 42q-5-10 7-8l64 31Z" fill="url(#' + g('deep') + ')" stroke="#5c38b7" stroke-width="5" stroke-linejoin="round"/>' +
        '<path d="m61 55 18 46 25-31Z" fill="url(#' + g('ear') + ')"/>' +
        '<path d="M224 108 256 42q5-10-7-8l-64 31Z" fill="url(#' + g('deep') + ')" stroke="#5c38b7" stroke-width="5" stroke-linejoin="round"/>' +
        '<path d="m239 55-18 46-25-31Z" fill="url(#' + g('ear') + ')"/>' +
        '<path class="bz-body" d="M92 183c10-31 35-48 58-48s48 17 58 48c8 24 7 63-8 82-13 17-87 17-100 0-15-19-16-58-8-82Z" fill="url(#' + g('deep') + ')" stroke="#5937b0" stroke-width="5"/>' +
        '<path class="bz-leg bz-leg-l" d="M116 221c-9 11-12 33-5 48 5 10 25 10 30 1 4-8 1-36-3-49Z" fill="url(#' + g('body') + ')" stroke="#6543bf" stroke-width="4"/>' +
        '<path class="bz-leg bz-leg-r" d="M184 221c9 11 12 33 5 48-5 10-25 10-30 1-4-8-1-36 3-49Z" fill="url(#' + g('body') + ')" stroke="#6543bf" stroke-width="4"/>' +
        '<ellipse cx="124" cy="270" rx="23" ry="11" fill="#6844ce"/><ellipse cx="176" cy="270" rx="23" ry="11" fill="#6844ce"/>' +
        '<path d="M150 58c66 0 103 36 98 98-4 50-41 81-98 81s-94-31-98-81c-5-62 32-98 98-98Z" fill="url(#' + g('body') + ')" stroke="#5c38b7" stroke-width="6"/>' +
        '<path d="M82 94c27-25 101-35 139 7" fill="none" stroke="#fff" stroke-opacity=".42" stroke-width="9" stroke-linecap="round"/>' +
        '<g class="bz-eye">' +
          '<ellipse cx="108" cy="151" rx="29" ry="35" fill="#fbfaff" stroke="#6548ad" stroke-width="4"/>' +
          '<g class="bz-track"><ellipse cx="109" cy="154" rx="20" ry="26" fill="url(#' + g('iris') + ')"/><ellipse cx="104" cy="145" rx="7" ry="9" fill="#fff"/></g>' +
          '<ellipse class="bz-lid" cx="108" cy="151" rx="31" ry="37" fill="#b39df7"/>' +
        '</g>' +
        '<g class="bz-eye">' +
          '<ellipse cx="192" cy="151" rx="29" ry="35" fill="#fbfaff" stroke="#6548ad" stroke-width="4"/>' +
          '<g class="bz-track"><ellipse cx="191" cy="154" rx="20" ry="26" fill="url(#' + g('iris') + ')"/><ellipse cx="186" cy="145" rx="7" ry="9" fill="#fff"/></g>' +
          '<ellipse class="bz-lid" cx="192" cy="151" rx="31" ry="37" fill="#b39df7"/>' +
        '</g>' +
        '<ellipse cx="75" cy="188" rx="18" ry="8" fill="#ff8fc8" opacity=".5"/><ellipse cx="225" cy="188" rx="18" ry="8" fill="#ff8fc8" opacity=".5"/>' +
        '<path d="m145 183 5-3 5 3-5 5Z" fill="#5b2c99"/>' +
        '<path class="bz-mouth" d="M150 188c-2 10-15 12-20 4m20-4c2 10 15 12 20 4" fill="none" stroke="#4b287c" stroke-width="4" stroke-linecap="round"/>' +
        '<g class="bz-chest" filter="url(#' + g('glow') + ')"><circle cx="150" cy="224" r="13" fill="#4a2d91" opacity=".4"/><circle cx="150" cy="224" r="8" fill="url(#' + g('syn') + ')" stroke="#e9fff7" stroke-width="2"/></g>' +
      '</g>' +
      '<g class="bz-ant" fill="none" stroke="#6e4bd5" stroke-width="7" stroke-linecap="round"><path d="M119 67Q103 31 84 27"/><path d="M181 67q16-36 35-40"/></g>' +
      '<g class="bz-pulse" filter="url(#' + g('glow') + ')"><circle cx="84" cy="27" r="11" fill="url(#' + g('syn') + ')" stroke="#effff9" stroke-width="3"/><circle cx="216" cy="27" r="11" fill="url(#' + g('syn') + ')" stroke="#effff9" stroke-width="3"/></g>' +
    '</svg>';
  }

  var STYLE_ID = 'bz-style';
  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var css = [
      '.bz-host{position:fixed;bottom:0;left:0;z-index:9999;pointer-events:none;will-change:transform}',
      '.bz-pet{position:relative;pointer-events:auto;cursor:pointer;touch-action:manipulation;transform-origin:50% 100%}',
      '.bz-char{display:block;width:100%;height:auto;overflow:visible;filter:drop-shadow(0 10px 12px rgba(45,26,105,.22))}',
      // два слоя: обёртка держит анимацию (transform), внутренний — кадр и зеркало.
      // На одном элементе они дрались бы за transform и зеркало слетало бы на анимации.
      // точка опоры — лапы: наклон и присед качают спрайт «от пола», как при шаге
      '.bz-skin{width:100%;aspect-ratio:1/1;transform-origin:50% 92%}',
      '.bz-skin-img{width:100%;height:100%;background-repeat:no-repeat}',
      // STRIP-скин сам анимируется сменой кадров (loadStrip). Процедурные CSS-анимации
      // (bzFloat/bzTrot/bzTap/зевок/потягивание/чесание/act) — для ВЕКТОРНОГО скина; на растре
      // они трансформируют кота поверх кадров и получается «дёргается/крутится». Глушим их для strip.
      '.bz-skin-strip{animation:none!important;transform:none!important}',
      // слой эффектов — поверх персонажа, мышь сквозь него проходит к питомцу
      '@keyframes bzBeacon{0%,100%{transform:translate(-50%,-50%) scale(.85)}50%{transform:translate(-50%,-50%) scale(1.25)}}',
      // КОЛЬЦО ПРОГРЕССА. Питомец сам становится индикатором: дуга по кругу заполняется опытом.
      // Выбрано потому, что КЛИК ПО ПИТОМЦУ ЗАНЯТ ЧАТОМ — вешать прогресс на жест нельзя, любой
      // жест надо сперва найти, а правого клика на телефоне не существует вовсе.
      // pointer-events:none обязательны: кольцо лежит поверх питомца и иначе съело бы нажатие.
      '.bz-ring{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);' +
        'pointer-events:none;z-index:1;border-radius:50%;transition:background .6s ease}',
      // Вырезаем середину маской — получается кольцо, а не заливка. Дырка 93%: тонкая дуга,
      // которая не спорит с силуэтом.
      '.bz-ring{-webkit-mask:radial-gradient(closest-side,transparent 93%,#000 94%);' +
        'mask:radial-gradient(closest-side,transparent 93%,#000 94%)}',
      // КАРТОЧКА показывается САМА на повышении формы и уходит. Постоянной панели нет намеренно:
      // на сайте у питомца угол размером с ноготь, и держать там табличку значит мешать сайту.
      '.bz-card{position:absolute;left:50%;bottom:100%;transform:translate(-50%,-8px) scale(.92);' +
        'pointer-events:none;z-index:6;min-width:172px;padding:11px 13px;border-radius:12px;' +
        'background:rgba(255,254,252,.97);color:#26241f;box-shadow:0 8px 26px rgba(40,32,20,.20);' +
        'font:13px/1.45 -apple-system,system-ui,Segoe UI,Roboto,sans-serif;' +
        'opacity:0;transition:opacity .3s ease,transform .3s ease}',
      '.bz-card.on{opacity:1;transform:translate(-50%,-12px) scale(1)}',
      '.bz-card b{display:block;font-weight:500;font-size:14.5px;margin-bottom:1px}',
      '.bz-card i{display:block;font-style:normal;color:#8d887f;font-size:11.5px}',
      '.bz-card u{display:block;text-decoration:none;height:7px;border-radius:4px;' +
        'background:#eae6de;margin:7px 0 3px;overflow:hidden}',
      '.bz-card u>s{display:block;height:100%;text-decoration:none;border-radius:4px;' +
        'background:currentColor;transition:width .5s ease}',
      '.bz-effect{position:absolute;left:0;top:0;pointer-events:none;z-index:3}',
      // слой сцены — под персонажем: предмет стоит на полу, питомец перед ним
      '.bz-scene{position:absolute;left:0;top:0;pointer-events:none;z-index:0}',
      // РАСТРОВЫЙ СКИН — ОДНА картинка на направление, отдельных лап нет. Походку
      // изображаем процедурно: 2-тактный подскок с наклоном и присед-подъёмом
      // (squash/stretch), как в пиксельных играх с единственным спрайтом.
      '.bz-pet.walk .bz-skin{animation:bzTrot .46s ease-in-out infinite}',
      '.bz-label{position:absolute;left:50%;bottom:100%;transform:translateX(-50%);margin-bottom:2px;font:600 11px/1.2 system-ui,-apple-system,sans-serif;white-space:nowrap;color:#4b287c;background:rgba(255,255,255,.86);border:1px solid rgba(124,92,252,.35);border-radius:8px;padding:2px 7px;pointer-events:none}',
      '.bz-pet.frozen .bz-char,.bz-pet.frozen .bz-skin{filter:grayscale(.55) saturate(.6) brightness(.94)}',
      '.bz-pet.drag{cursor:grabbing;z-index:1}',
      '.bz-pet.drag .bz-char,.bz-pet.drag .bz-skin{animation:none;transform:scale(1.06)}',
      '.bz-pet.fall .bz-char,.bz-pet.fall .bz-skin{animation:none}',
      '.bz-pet.idle .bz-skin{animation:bzFloat 3.2s ease-in-out infinite}',
      '.bz-pet.type .bz-skin{animation:bzBob calc(var(--bz-tempo,.18s)*2) ease-in-out infinite}',
      '.bz-pet.sleep .bz-skin{animation:bzSleep 4.8s ease-in-out infinite;filter:saturate(.8)}',
      '.bz-shadow{position:absolute;left:50%;bottom:-4px;transform:translateX(-50%);width:62%;height:14px;border-radius:50%;background:rgba(90,62,206,.20);filter:blur(7px)}',
      '.bz-bubble{position:absolute;bottom:100%;left:50%;transform:translate(-50%,-6px);max-width:200px;padding:8px 12px;border:1px solid rgba(255,255,255,.9);border-radius:14px 14px 14px 4px;background:rgba(255,255,255,.94);color:#2a1c55;font:600 12px/1.35 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;box-shadow:0 14px 30px -18px rgba(31,18,82,.6);opacity:0;transition:opacity .25s ease,transform .25s ease;pointer-events:none;white-space:normal}',
      '.bz-bubble.on{opacity:1;transform:translate(-50%,-12px)}',
      '.bz-track{transform:translate(var(--bz-x,0px),var(--bz-y,0px));transition:transform .12s ease-out}',
      '.bz-lid{transform-box:fill-box;transform-origin:center;animation:bzBlink 5.4s ease-in-out infinite}',
      '.bz-tail{transform-origin:224px 197px;animation:bzTail 2.1s ease-in-out infinite}',
      '.bz-pulse circle{animation:bzPulse 1.8s ease-in-out infinite}.bz-pulse circle:last-child{animation-delay:.35s}',
      '.bz-pet.walk .bz-char{animation:bzBob .52s ease-in-out infinite}',
      '.bz-pet.walk .bz-leg-l{animation:bzStepA .52s ease-in-out infinite}',
      '.bz-pet.walk .bz-leg-r{animation:bzStepB .52s ease-in-out infinite}',
      '.bz-pet.idle .bz-char{animation:bzFloat 3.2s ease-in-out infinite}',
      '.bz-pet.sleep .bz-char{animation:bzSleep 4.8s ease-in-out infinite;filter:drop-shadow(0 8px 10px rgba(45,26,105,.18)) saturate(.82)}',
      '.bz-pet.sleep .bz-lid{transform:scaleY(1);animation:none}',
      '.bz-pet.sleep .bz-tail{animation-duration:5.2s}',
      '@keyframes bzSleep{50%{transform:translateY(-3px) scale(1.012)}}',
      '.bz-pet.tap .bz-char{animation:bzTap .6s cubic-bezier(.2,.9,.2,1)}',
      // «печатает вместе с тобой»: лапы стучат, темп задаётся --bz-tempo из ритма клавиш
      '.bz-pet.type .bz-char{animation:bzBob calc(var(--bz-tempo,.18s)*2) ease-in-out infinite}',
      '.bz-pet.type .bz-leg-l{animation:bzTapPaw var(--bz-tempo,.18s) ease-in-out infinite}',
      '.bz-pet.type .bz-leg-r{animation:bzTapPaw var(--bz-tempo,.18s) ease-in-out infinite .09s}',
      '.bz-pet.type .bz-pulse{animation-duration:.7s}',
      '@keyframes bzTapPaw{50%{transform:translateY(-9px) rotate(-4deg)}}',
      '@keyframes bzBob{50%{transform:translateY(-5px)}}',
      '@keyframes bzFloat{50%{transform:translateY(-8px) rotate(1deg)}}',
      '@keyframes bzStepA{50%{transform:translateY(-6px) rotate(-7deg)}}',
      '@keyframes bzStepB{50%{transform:translateY(-6px) rotate(7deg)}}',
      '@keyframes bzTap{35%{transform:translateY(-26px) scale(1.06)}68%{transform:translateY(2px) scale(.97)}}',
      '@keyframes bzTail{50%{transform:rotate(9deg)}}',
      // ── ХАРАКТЕР ТРАНСФОРМОМ, А НЕ КАДРАМИ. Призрак тает, гриб растёт, слайм расплывается,
      // овоид качается, пингвин мёрзнет — это не анимации персонажа, а преобразования спрайта.
      // Рисовать под них кадры незачем: одна и та же пятёрка правил работает на всех 33 паках.
      '@keyframes bzFxFade{0%,100%{opacity:1}50%{opacity:.18}}',
      '@keyframes bzFxGrow{0%,100%{transform:scale(1)}50%{transform:scale(1.16)}}',
      '@keyframes bzFxSquash{0%,100%{transform:scale(1,1)}35%{transform:scale(1.18,.84)}70%{transform:scale(.9,1.12)}}',
      '@keyframes bzFxWobble{0%,100%{transform:rotate(0)}25%{transform:rotate(-7deg)}75%{transform:rotate(7deg)}}',
      '@keyframes bzFxShiver{0%,100%{transform:translateX(0)}25%{transform:translateX(-2px)}75%{transform:translateX(2px)}}',
      // ── БОГАТЫЕ ПРОСТОИ. Процедурные (трансформы тела), а не отдельные кадры:
      // так они работают и на встроенном SVG, и на растровом скине, где кадров
      // на «зевает/чешется» просто нет и рисовать их отдельно не нужно.
      '.bz-pet.act .bz-char,.bz-pet.act .bz-skin{animation:var(--bz-act)!important}',
      '@keyframes bzYawn{0%,100%{transform:none}25%{transform:translateY(-4px) scaleY(1.09) scaleX(.97)}55%{transform:translateY(1px) scaleY(.94) scaleX(1.04)}}',
      '@keyframes bzScratch{0%,100%{transform:none}10%,30%,50%,70%{transform:rotate(-5deg) translateX(-3px)}20%,40%,60%{transform:rotate(4deg) translateX(3px)}}',
      '@keyframes bzStretch{0%,100%{transform:none}40%{transform:scaleX(1.12) scaleY(.88) translateY(4px)}70%{transform:scaleX(.95) scaleY(1.06) translateY(-4px)}}',
      '@keyframes bzGroom{0%,100%{transform:none}20%,60%{transform:rotate(-8deg) translateY(2px)}40%,80%{transform:rotate(-2deg) translateY(-1px)}}',
      // «царапает край»: упирается в стену и молотит лапами вбок
      '@keyframes bzEdge{0%,100%{transform:none}15%,45%,75%{transform:translateX(calc(var(--bz-wall,1)*7px)) rotate(calc(var(--bz-wall,1)*4deg))}30%,60%,90%{transform:translateX(calc(var(--bz-wall,1)*2px))}}',
      '@keyframes bzPulse{50%{transform:scale(1.45);opacity:.6}}',
      '@keyframes bzBlink{0%,45%,49%,100%{transform:scaleY(0)}47%{transform:scaleY(1)}}',
      '@media(prefers-reduced-motion:reduce){.bz-char,.bz-tail,.bz-lid,.bz-pulse circle,.bz-leg{animation:none!important}}'
    ].join('');
    var el = document.createElement('style');
    el.id = STYLE_ID;
    el.textContent = css;
    document.head.appendChild(el);
  }

  // Язык страницы, а не наш родной. Раньше запасным всюду стоял русский, и сайт, не указавший
  // data-lang, получал русскоговорящего питомца на англоязычной странице. Берём объявленный
  // язык документа, нормализуем ('en-US' → 'en'), незнакомый уводим в английский.
  function pageLang() {
    try {
      var raw = (document.documentElement.getAttribute('lang') || '').toLowerCase();
      return raw.split('-')[0] || '';
    } catch (e) { return ''; }
  }

  function resolveLang(wanted) {
    var order = [String(wanted || '').toLowerCase().split('-')[0], pageLang(), 'en', 'ru'];
    for (var i = 0; i < order.length; i++) if (order[i] && LINES[order[i]]) return order[i];
    return 'en';
  }

  function Pet(opts) {
    opts = opts || {};
    opts.lang = resolveLang(opts.lang);
    var ns = uid();
    var size = opts.size || 120;
    var speed = opts.speed || 46;              // px/сек
    var lines = opts.lines || LINES[opts.lang] || LINES.en;
    var chatter = opts.chatter !== false;
    var bottom = opts.bottom == null ? 12 : opts.bottom;

    injectStyle();

    var host = document.createElement('div');
    host.className = 'bz-host';
    host.style.bottom = bottom + 'px';
    var pet = document.createElement('div');
    pet.className = 'bz-pet idle';
    pet.style.width = size + 'px';
    pet.setAttribute('role', 'button');
    pet.setAttribute('tabindex', '0');
    pet.setAttribute('aria-label', DEFAULT_NAME[opts.lang] || DEFAULT_NAME.en);

    // Встроенный векторный котик — запасной вариант, а не заставка. Пока грузился пак, он успевал
    // отрисоваться, и на сайте на долю секунды всплывал фиолетовый призрак чужого питомца, а уже
    // потом появлялся свой. Прячем его сразу, если скин заведомо будет: покажем обратно, только
    // если пак не загрузится.
    if (opts.pack || opts.image) {
      var builtin = pet.querySelector('.bz-char');
      if (builtin) builtin.style.display = 'none';
    }

    // Фразы на языке страницы приходят ИЗ СЕРВИСА, а не из движка: в канале лежит lines/<язык>.json,
    // и новый язык добавляется одним файлом — без правки движка и без пересборки сайтов. Встроенные
    // русский с английским остаются запасным вариантом на случай, если сервис недоступен.
    function loadServiceLines(base, lang, name) {
      if (!global.fetch || !base || opts.lines) return;
      var tries = [lang, 'en'];
      (function next(i) {
        if (i >= tries.length) return;
        fetch(String(base).replace(/\/$/, '') + '/lines/' + tries[i] + '.json')
          .then(function (r) { return r.ok ? r.json() : null; })
          .then(function (data) {
            if (!data || !data.lines) return next(i + 1);
            var t = data.lines, who = name || DEFAULT_NAME[opts.lang] || DEFAULT_NAME.en;
            lines = [t.hello, t.idle, t.tap, t.help, t.near]
              .filter(Boolean).map(function (x) { return String(x).replace('{name}', who); });
            if (t.hungry && t.tired && t.bored) needs = { hungry: t.hungry, tired: t.tired, bored: t.bored };
          })
          .catch(function () { next(i + 1); });
      })(0);
    }

    // Имя приходит вместе с паком (асинхронно), поэтому подпись и реплики обновляем на месте.
    function applyIdentity(nameRu, nameEn) {
      var who = (opts.lang === 'ru' ? nameRu : (nameEn || nameRu)) || '';
      if (!who) return;
      baseName = who;
      pet.setAttribute('aria-label', who);
      var svg = pet.querySelector('.bz-char');
      if (svg) svg.setAttribute('aria-label', who);
      // Реплики, заданные сайтом (data-lines-url или opts.lines), НЕ трогаем: там свой тон,
      // и подменять его именем питомца было бы самоуправством.
      if (!opts.lines) lines = linesFor(opts.lang === 'ru' ? 'ru' : 'en', who);
    }
    // Встроенного векторного котика НЕ рисуем вовсе, если у питомца будет свой скин. Прятать его
    // после вставки поздно: он успевал мелькнуть, и на сайте на долю секунды всплывал фиолетовый
    // призрак чужого питомца, а уже потом появлялся свой (поймал Денис на живых сайтах).
    // Если пак не загрузится, вектор дорисуем как запасной вариант — см. ниже по коду.
    var willHaveSkin = Boolean(opts.pack || opts.image);
    pet.innerHTML = '<div class="bz-bubble"></div>' +
      (willHaveSkin ? '' : characterSVG(ns)) + '<div class="bz-shadow"></div>';
    // ярлык: кого этот питомец представляет (в стае — имя проекта)
    if (opts.label) {
      var lab = document.createElement('div');
      lab.className = 'bz-label';
      lab.textContent = opts.label;
      pet.appendChild(lab);
    }
    host.appendChild(pet);
    (opts.mount || document.body).appendChild(host);

    // Инлайн-режим: если смонтирован в контейнер (не body), питомец живёт ВНУТРИ него
    // (кнопка чата / ячейка витрины), а не фиксируется к нижней кромке экрана.
    var mounted = opts.mount && opts.mount !== document.body;
    if (mounted) {
      if (global.getComputedStyle && getComputedStyle(opts.mount).position === 'static')
        opts.mount.style.position = 'relative';
      host.style.position = 'absolute';
      host.style.left = '0'; host.style.right = '0'; host.style.width = '100%';
      pet.style.margin = '0 auto';
    }

    var bubble = pet.querySelector('.bz-bubble');
    var tracks = pet.querySelectorAll('.bz-track');

    // bounds — внешняя площадка для прогулки. В десктоп-оболочке это ВЕСЬ ЭКРАН:
    // питомец сидит в маленьком окне, а по экрану ездит само окно (opts.onMove).
    var bounds = opts.bounds || null;
    function vw() { return bounds ? bounds.w : Math.max(320, global.innerWidth || 1024); }
    function vh() { return bounds ? bounds.h : (global.innerHeight || 768); }
    function maxX() { return Math.max(0, vw() - (bounds ? 0 : size + 8)); }
    function maxY() { return roam ? Math.max(0, vh() - (bounds ? 0 : size + 8 + bottom)) : 0; }

    // ── персистентность: позиция и сон переживают перезагрузку страницы
    var STORE_KEY = 'bz-state-' + (opts.id || 'default');
    var saved = null;
    try { saved = JSON.parse(localStorage.getItem(STORE_KEY) || 'null'); } catch (e) {}

    // opts.x бьёт сохранённую позицию: у адаптеров (стая) место питомца задаёт раскладка,
    // а не то, где он гулял в прошлый раз
    var x = typeof opts.x === 'number'
      ? Math.max(0, Math.min(maxX(), opts.x))
      : saved && typeof saved.x === 'number'
        ? Math.max(0, Math.min(maxX(), saved.x))
        : Math.min(maxX(), Math.round(maxX() * 0.62));
    var target = x;
    // y — высота над нижней кромкой; 0 = «ходит по полу», >0 только в режиме roam
    var roam = !!opts.roam;
    var y = saved && typeof saved.y === 'number' ? saved.y : 0;
    var targetY = y;
    var dir = 1;
    var mode = 'idle';
    var nextDecision = 0;
    var bubbleUntil = 0;
    var last = 0;
    var raf = null;
    var alive = true;

    // ── машина покоя → сна (паттерн oneko: счётчик простоя)
    var sleepAfter = opts.sleepAfter == null ? 45000 : opts.sleepAfter; // мс покоя до сна; 0 = не засыпать
    var idleSince = performance.now();
    var asleep = false;
    var frozen = false;      // состояние задано адаптером, а не поведением питомца
    var frozenText = '';
    var follow = !!opts.follow;      // режим «ходить за курсором»
    var pointerX = null;
    var saveTimer = 0;

    // ── ПЕТЛЯ ЗАБОТЫ: потребности убывают со временем (в т.ч. пока страница закрыта),
    // взаимодействия их поднимают и дают опыт. Без неё питомец — украшение.
    // care:false — самочувствие задаёт адаптер снаружи (в стае оно отражает состояние дела,
    // и автономное убывание перетирало бы данные)
    var autoCare = opts.care !== false;
    var care = {
      energy: 80, fullness: 70, mood: 75,   // 0..100
      xp: 0, level: 1,
      seen: Date.now()
    };
    if (saved && saved.care) for (var k in care) if (saved.care[k] != null) care[k] = saved.care[k];

    // скорость убывания в единицах/час
    var DECAY = { energy: 4, fullness: 7, mood: 5 };
    var clamp100 = function (v) { return Math.max(0, Math.min(100, v)); };

    function decay(hours) {
      if (!(hours > 0)) return;
      care.energy = clamp100(care.energy - DECAY.energy * hours);
      care.fullness = clamp100(care.fullness - DECAY.fullness * hours);
      // настроение проседает сильнее, если голоден или вымотан
      var penalty = (care.fullness < 30 ? 1.6 : 1) * (care.energy < 25 ? 1.5 : 1);
      care.mood = clamp100(care.mood - DECAY.mood * hours * penalty);
    }
    // офлайн-убывание за время отсутствия (не больше 12 ч, чтобы не убивать питомца за отпуск)
    if (autoCare) decay(Math.min(12, (Date.now() - care.seen) / 3600000));
    care.seen = Date.now();

    function gain(field, amount) {
      care[field] = clamp100(care[field] + amount);
      care.xp += Math.max(1, Math.round(amount / 4));
      var nextLevel = 1 + Math.floor(care.xp / 60);
      var grew = nextLevel > care.level;
      care.level = nextLevel;
      persist();
      if (grew && typeof opts.onLevelUp === 'function') { try { opts.onLevelUp(care.level, api); } catch (e) {} }
      return grew;
    }

    /** самочувствие → поведение: вялый когда пусто, бодрый когда хорошо */
    function vigor() { return 0.55 + 0.45 * ((care.energy + care.mood) / 200); }

    var needs = NEEDS[opts.lang] || NEEDS.en || NEEDS.ru;
    var lastNag = 0;
    function needLine() {
      var pool = care.fullness < 22 ? needs.hungry : care.energy < 18 ? needs.tired : needs.sad;
      return pool[Math.floor(Math.random() * pool.length)];
    }

    /** Разово проиграть преобразование спрайта: тает, растёт, качается, дрожит.
     *
     * Вешаем на КОНТЕЙНЕР скина, а не на сам спрайт: у спрайта transform уже занят отзеркаливанием
     * при смене направления (см. skinImg.style.transform), и анимация бы его затирала — питомец
     * разворачивался бы посреди движения.
     */
    var FX = { fade: 'bzFxFade', grow: 'bzFxGrow', squash: 'bzFxSquash',
               wobble: 'bzFxWobble', shiver: 'bzFxShiver' };
    function runFx(name, ms, times) {
      var kf = FX[name];
      if (!kf || !skin) return false;
      var dur = Math.max(300, (ms || 2400) / (times || 2));
      skin.style.animation = kf + ' ' + dur + 'ms ease-in-out ' + (times || 2);
      setTimeout(function () { if (skin) skin.style.animation = ''; }, (ms || 2400) + 80);
      return true;
    }

    /** Разово проиграть состояние и вернуться в основное — для привычек и реакций. */
    function actOnce(name, holdMs) {
      if (!api.state(name)) return false;
      if (actTimer) clearTimeout(actTimer);
      actTimer = setTimeout(function () {
        if (alive) api.state(primaryState || 'idle');
      }, holdMs || 4500);
      return true;
    }

    /**
     * Привычка активна сейчас? hours — окно часов местного времени посетителя, [22, 7] значит
     * «с десяти вечера до семи утра» и корректно переваливает через полночь.
     *
     * ЗАЧЕМ. Сова днём спит, а волк воет по вечерам — это не отдельные состояния, а УСЛОВИЕ,
     * когда играть уже имеющиеся. Питомец, который ведёт себя по-разному утром и ночью,
     * читается как живой сильнее, чем ещё одна анимация: одно и то же движение начинает
     * что-то значить. Без окна пришлось бы снимать зверю вдвое больше состояний ради того же.
     */
    function inHours(hours) {
      if (!hours || hours.length !== 2) return true;
      var h = new Date().getHours(), from = hours[0], to = hours[1];
      return from <= to ? (h >= from && h < to) : (h >= from || h < to);
    }

    /** Характер из пака: аппетит + привычки. */
    function startPersona(persona) {
      // сколько сытости уходит за час. НОЛЬ — осмысленное значение: робот, призрак и звезда не
      // едят вовсе. Раньше ноль молча игнорировался, и они голодали наравне с котом.
      if (typeof persona.appetite === 'number') DECAY.fullness = Math.max(0, persona.appetite);
      (persona.habits || []).forEach(function (habit) {
        // привычка может быть анимацией (state), эффектом поверх персонажа (effect) или обеими:
        // фениксу незачем новое состояние, ему нужно раз в пару минут вспыхнуть
        if (!habit || (!habit.state && !habit.effect && !habit.fx)) return;
        var range = habit.everyMs || [60000, 120000];
        (function schedule() {
          // ⚠️ ЖИВОСТЬ РАСТЁТ С УРОВНЕМ. Это и есть «поведение вместо внешности»: на девятом
          // уровне питомец шевелится вдвое чаще, чем на первом. Приоритет Дениса 16.08 —
          // взять эту механику ПЕРВОЙ, потому что её нельзя украсть по скриншоту: конкурент
          // видит картинку, а не то, как часто зверь отвечает.
          // Делитель, а не множитель: живее — значит МЕНЬШЕ пауза между действиями.
          var span = Math.max(0, (range[1] || range[0]) - range[0]);
          var wait = (range[0] + Math.random() * span) / (liveliness || 1);
          habitTimers.push(setTimeout(function () {
            if (!alive) return;
            // привычку не навязываем поверх сна и перетаскивания — питомец не робот
            if (!asleep && !drag && inHours(habit.hours)) {
              if (habit.effect && api.effect) api.effect(habit.effect, habit.holdMs || 4500);
              if (habit.fx) runFx(habit.fx, habit.holdMs, habit.fxTimes);
              if (habit.state && actOnce(habit.state, habit.holdMs)) {
                if (habit.state.indexOf('eat') >= 0) care.fullness = clamp100(care.fullness + 22);
              }
            }
            schedule();
          }, wait));
        })();
      });
    }

    function persist() {
      try {
        care.seen = Date.now();
        localStorage.setItem(STORE_KEY, JSON.stringify({ x: Math.round(x), y: Math.round(y),
          dragDX: Math.round(dragDX), dragDY: Math.round(dragDY), asleep: asleep, care: care }));
      } catch (e) {}
    }

    // ── СКИН .petpack: растровые спрайты вместо встроенного SVG.
    // Один лист + сдвиг фона = один запрос на все ракурсы. Левые направления
    // берутся зеркалом правых (карта в frames.json), как в спрайтовых играх.
    var pack = null, skin = null, skinImg = null, curDir = null, stripTimer = null;
    var anchors = null, gearEl = {};
    var packForms = null, baseName = null, curForm = null, liveliness = 1, dormantOn = -1;
    var cardTimer = null, shownForm = null;
    // Реплика на каждую форму — самый дешёвый способ дать питомцу «голос уровня».
    var lineForForm = {
      'Постигающий': 'Кажется, я начинаю понимать…', 'Просветлённый': 'Теперь я вижу дальше.',
      'Вознесённый': 'Спрашивай — отвечу.', 'Разгон': 'Системы разогреты.',
      'Форсаж': 'Работаю на полной.', 'Полная мощность': 'Предел? Не слышал.',
      'Прирученный': 'Я тебя запомнил!', 'Ухоженный': 'Хорошо выгляжу, правда?',
      'Чемпион': 'Со мной не пропадёшь.', 'Горящий': 'Горячо!',
      'Пылающий': 'Я весь свечусь.', 'Ослепительный': 'Не смотри прямо на меня.',
      'Бессмертный': 'Я видел начало и увижу конец.', 'Сверхпроводник': 'Сопротивление — ноль.',
      'Легенда': 'Про меня рассказывают.', 'Сверхновая': 'Я вспыхну — и ты запомнишь.'
    };      // якоря пака и надетые предметы, по одному на якорь
    var packRoot = null, packStates = null, curState = null, beatTimer = null;
    var primaryState = null, actTimer = null, habitTimers = [];
    var DIR8 = ['e', 'se', 's', 'sw', 'w', 'nw', 'n', 'ne'];

    function dirName(dx, dyScreen) {
      var a = Math.atan2(dyScreen, dx) * 180 / Math.PI;   // 0° = восток, 90° = вниз
      if (a < 0) a += 360;
      return DIR8[Math.round(a / 45) % 8];
    }

    function applyDir(name) {
      if (!pack || name === curDir) return;
      var d = pack.directions[name] || pack.directions.s;
      if (!d) return;
      curDir = name;
      var cx = d.cell % pack.cols, cy = Math.floor(d.cell / pack.cols);
      skinImg.style.backgroundPosition =
        (pack.cols > 1 ? (cx / (pack.cols - 1)) * 100 : 0) + '% ' +
        (pack.rows > 1 ? (cy / (pack.rows - 1)) * 100 : 0) + '%';
      skinImg.style.transform = d.mirror ? 'scaleX(-1)' : 'scaleX(1)';
    }

    /** Подключить скин. Питомец живёт на SVG и молча переезжает на спрайты, когда те дошли. */
    function loadPack(base) {
      if (!global.fetch) return;
      var root = String(base).replace(/\/$/, '');
      fetch(root + '/frames.json').then(function (r) {
        if (!r.ok) throw new Error('frames.json: ' + r.status);
        return r.json();
      }).then(function (meta) {
        if (!alive || !meta || !meta.directions) return;
        pack = meta;
        skin = document.createElement('div');
        skin.className = 'bz-skin';
        skinImg = document.createElement('div');
        skinImg.className = 'bz-skin-img';
        skinImg.style.backgroundImage = 'url("' + root + '/sheet.png")';
        skinImg.style.backgroundSize = (meta.cols * 100) + '% ' + (meta.rows * 100) + '%';
        // пиксель-скин рендерим чётко, без сглаживания — иначе крупные пиксели мылятся
        if (meta.pixel) skinImg.style.imageRendering = 'pixelated';
        skin.appendChild(skinImg);
        var svg = pet.querySelector('.bz-char');
        if (svg) svg.style.display = 'none';
        pet.insertBefore(skin, pet.querySelector('.bz-shadow'));
        curDir = null;
        applyDir('s');
        if (typeof opts.onPack === 'function') { try { opts.onPack(meta, api); } catch (e) {} }
      }).catch(function (e) {
        // скин не приехал — остаёмся на встроенном SVG, питомец продолжает жить
        if (global.console) console.warn('[бирюзик] скин не загрузился:', e.message);
      });
    }
    /** Статичный скин: одна картинка-эталон. Питомец не ходит по направлениям, но
     *  ЖИВЁТ процедурно — дышит/парит (idle) и подпрыгивает по тапу. Хватает для
     *  «живой кнопки чата» на сайте, пока нет анимации/направлений. */
    function loadStatic(url) {
      skin = document.createElement('div');
      skin.className = 'bz-skin bz-skin-static';
      skinImg = document.createElement('div');
      skinImg.className = 'bz-skin-img';
      skinImg.style.backgroundImage = 'url("' + url + '")';
      skinImg.style.backgroundSize = 'contain';
      skinImg.style.backgroundPosition = 'center bottom';
      skin.appendChild(skinImg);
      var svg = pet.querySelector('.bz-char');
      if (svg) svg.style.display = 'none';
      pet.insertBefore(skin, pet.querySelector('.bz-shadow'));
      pack = { directions: {}, cols: 1, rows: 1, staticSkin: true };  // выключает выбор направления
    }
    /** Strip-скин: одиночный цикл анимации (лист cut_animcycle → anim.json + walk-strip.png).
     *  Проигрываем полосу сдвигом фона по кадрам (idle/walk на месте, без направлений).
     *  Это формат, который производит наш конвейер и раздаёт сервис. */
    // Слой эффектов: сердечки, конфетти, пар — отдельным спрайт-циклом ПОВЕРХ персонажа.
    //
    // Пока эффект нарисован внутри кадра, он отъедает место: персонаж съёживается, освобождая
    // ему угол, и вдобавок пульсирует, потому что эффект то появляется, то тает. Вынесенный слой
    // снимает обе беды и даёт главное — один раз добытые сердечки ложатся на ЛЮБОГО маскота.
    //
    // Кадры эффекта живут в той же квадратной системе, что и кадры персонажа, а персонажи
    // нормализованы к общему росту, поэтому слой кладётся той же коробкой. Данные о якоре
    // (anchor/offset/scale в effect.json) нужны позже — когда захочется сажать эффект на
    // маскота с сильно другими пропорциями.
    var effectTimer = null, effectEl = null, sceneEl = null;

    // Слой сцены: лоток, миска, коврик — ПОД персонажем.
    //
    // Тот же приём, что с эффектами, но снизу и статикой. Смысл в первопричине: пока лоток
    // нарисован внутри кадра, он отъедает у питомца место — на состоянии «туалет» кот терял треть
    // роста и зрительно уходил вглубь экрана. Вынесенный предмет освобождает кадр целиком и
    // работает на любом маскоте: одна нарисованная сцена — 31 применение.
    // Путь до слоя: голое имя ('hearts') разворачивается рядом с паками, а всё, где есть косая
    // черта, берётся как есть — и абсолютное, и относительное. Раньше './effects/hearts'
    // принималось за имя и приклеивалось к базе, отчего слой уходил в 404.
    function layerUrl(nameOrUrl, kind) {
      var value = String(nameOrUrl);
      if (value.indexOf('/') >= 0) return value;
      var base = opts[kind === 'scenes' ? 'scenesBase' : 'effectsBase'];
      if (!base) {
        base = (opts.pack ? String(opts.pack).replace(/\/[^/]+\/?$/, '') : '.') + '/../' + kind;
      }
      return base + '/' + value;
    }

    function playScene(dirUrl) {
      if (!global.fetch) return;
      var base = String(dirUrl).replace(/\/+$/, '');
      fetch(base + '/scene.json').then(function (r) {
        if (!r.ok) throw new Error('scene.json: ' + r.status);
        return r.json();
      }).then(function (meta) {
        if (!alive || !meta) return;
        stopScene();
        sceneEl = document.createElement('div');
        sceneEl.className = 'bz-scene';
        sceneEl.style.width = size + 'px';
        sceneEl.style.height = size + 'px';
        sceneEl.style.backgroundImage = 'url("' + base + '/' + (meta.image || 'scene.png') + '")';
        sceneEl.style.backgroundRepeat = 'no-repeat';
        sceneEl.style.backgroundSize = '100% 100%';
        pet.insertBefore(sceneEl, pet.firstChild);
      }).catch(function (e) {
        if (global.console) console.warn('[бирюзик] сцена не загрузилась:', e.message);
      });
    }

    function stopScene() {
      if (sceneEl && sceneEl.parentNode) sceneEl.parentNode.removeChild(sceneEl);
      sceneEl = null;
    }

    function stopEffect() {
      if (effectTimer) { clearInterval(effectTimer); effectTimer = null; }
      if (effectEl && effectEl.parentNode) effectEl.parentNode.removeChild(effectEl);
      effectEl = null;
    }

    function playEffect(dirUrl, durationMs) {
      if (!global.fetch) return;
      var base = String(dirUrl).replace(/\/+$/, '');
      fetch(base + '/effect.json').then(function (r) {
        if (!r.ok) throw new Error('effect.json: ' + r.status);
        return r.json();
      }).then(function (meta) {
        if (!alive || !meta || !meta.frames) return;
        stopEffect();
        effectEl = document.createElement('div');
        effectEl.className = 'bz-effect';
        effectEl.style.width = size + 'px';
        effectEl.style.height = size + 'px';
        effectEl.style.backgroundImage = 'url("' + base + '/' + (meta.strip || 'strip.png') + '")';
        effectEl.style.backgroundRepeat = 'no-repeat';
        effectEl.style.backgroundSize = (meta.frames * 100) + '% 100%';
        pet.appendChild(effectEl);
        var i = 0, n = meta.frames, fps = meta.fps || 12;
        effectTimer = setInterval(function () {
          if (!alive) { stopEffect(); return; }
          effectEl.style.backgroundPosition = (n > 1 ? (i / (n - 1)) * 100 : 0) + '% 0%';
          i = (i + 1) % n;
        }, 1000 / fps);
        // разовый показ: сам убирается, чтобы не висеть поверх питомца вечно
        if (durationMs !== 0) setTimeout(stopEffect, durationMs || Math.round(n / fps * 1000 * 2));
      }).catch(function (e) {
        if (global.console) console.warn('[бирюзик] эффект не загрузился:', e.message);
      });
    }

    function loadStrip(sheetUrl, animUrl) {
      if (!global.fetch) return;
      fetch(animUrl).then(function (r) { if (!r.ok) throw new Error('anim.json: ' + r.status); return r.json(); })
        .then(function (meta) {
          if (!alive || !meta || !meta.frames) return;
          // Старую картинку убираем ДО вставки новой: при переключении состояния (idle → walk)
          // прежний слой иначе остаётся в DOM, и на экране оказываются два питомца друг на друге.
          if (skin && skin.parentNode) skin.parentNode.removeChild(skin);
          skin = document.createElement('div');
          skin.className = 'bz-skin bz-skin-strip';
          // ⚠️ КАДР НЕ ОБЯЗАН БЫТЬ КВАДРАТНЫМ. Долгое время он был, и это ломало боковую ходьбу:
          // четвероногий в профиль ДЛИННЫЙ И НИЗКИЙ, в квадрат он влезает только сильно ужатым.
          // Замер 16.08.2026 на лисе: анфас силуэт занимал 45082 px², боком — 22026, ровно вдвое
          // меньше. При переключении покой → ходьба зверь съёживался на глазах. Дотянуть боковую
          // до той же массы внутри квадрата невозможно: ей нужно 375 px ширины при клетке 300.
          // Поэтому ряд может объявить свою пропорцию: cellW/cellH в anim.json. Нет их — квадрат,
          // как раньше, и все старые паки продолжают работать без правок.
          var cw = meta.cellW || meta.size || size;
          var chh = meta.cellH || meta.size || size;
          // Высоту держим равной size, ширину растим по пропорции: питомец стоит на той же
          // линии пола и не подпрыгивает при смене состояния.
          var boxW = Math.round(size * (cw / chh));
          skin.style.width = boxW + 'px';
          skin.style.height = size + 'px';
          // коробка шире — сдвигаем влево на половину прироста, чтобы центр остался на месте
          skin.style.marginLeft = Math.round((size - boxW) / 2) + 'px';
          skinImg = document.createElement('div');
          skinImg.className = 'bz-skin-img';
          skinImg.style.backgroundImage = 'url("' + sheetUrl + '")';
          skinImg.style.backgroundRepeat = 'no-repeat';
          skinImg.style.backgroundSize = (meta.frames * 100) + '% 100%';
          skin.appendChild(skinImg);
          var svg = pet.querySelector('.bz-char');
          if (svg) svg.style.display = 'none';
          pet.insertBefore(skin, pet.querySelector('.bz-shadow'));
          // Слой скина только что заменён — вернуть на него заработанные предметы, иначе
          // питомец «раздевается» при каждой смене состояния (см. пояснение в api._wear).
          if (global.__ODVMASCOT && global.__ODVMASCOT.applyUnlocks)
            setTimeout(global.__ODVMASCOT.applyUnlocks, 0);
          pack = { directions: {}, cols: 1, rows: 1, staticSkin: true, strip: true };
          var i = 0, n = meta.frames, fps = meta.fps || 7;
          function show(frame) {
            i = ((frame % n) + n) % n;
            skinImg.style.backgroundPosition = (n > 1 ? (i / (n - 1)) * 100 : 0) + '% 0%';
          }
          // Гасим ОБА таймера: у живого покоя их два — пауза между всплесками и сам всплеск.
          // Раньше при переключении idle→walk снимался только первый, второй продолжал крутить
          // кадры покоя поверх ходьбы (баг поймал grovi-codex-mac: два активных таймера).
          if (stripTimer) { clearInterval(stripTimer); clearTimeout(stripTimer); stripTimer = null; }
          if (beatTimer) { clearInterval(beatTimer); beatTimer = null; }

          // ЖИВОЙ ПОКОЙ. Крутить цикл без остановки — это не «питомец сидит», а «питомец
          // тараторит»: зверушка дёргалась безостановочно, и Денис справедливо это забраковал.
          // Живое существо в покое почти всё время неподвижно, изредка моргает, иногда кивает
          // или машет лапой — и снова замирает. Поэтому в покое держим позу, а раз в 5–10 секунд
          // проигрываем КОРОТКИЙ отрывок цикла и возвращаемся в неё же.
          //
          // Отрывок берём случайным окном: кадры листа и есть фазы (вдох, моргание, наклон,
          // жест), поэтому разные окна дают разные «всплески» без единой новой картинки.
          // Короткие всплески (2–3 кадра) выпадают чаще длинных — это и читается как моргание.
          // покой определяем по имени папки состояния в пути: .../idle/anim.json
          var restful = meta.rest !== false && /(^|\/)idle\/[^/]*$/.test(String(animUrl));
          if (!restful) {
            stripTimer = setInterval(function () {
              if (!alive) { clearInterval(stripTimer); stripTimer = null; return; }
              show(i + 1);
            }, 1000 / fps);
            show(0);
          } else {
            function rest() {
              show(0);                                   // поза покоя — первый кадр листа
              stripTimer = setTimeout(beat, 5000 + Math.random() * 5000);   // пауза 5–10 с
            }
            function beat() {
              if (!alive) return;
              var short = Math.random() < 0.6;           // чаще моргание, реже жест
              var len = short ? 2 + Math.floor(Math.random() * 2) : 4 + Math.floor(Math.random() * 3);
              var start = 1 + Math.floor(Math.random() * Math.max(1, n - 1));
              var played = 0;
              beatTimer = setInterval(function () {
                if (!alive) { clearInterval(beatTimer); return; }
                show(start + played);
                if (++played >= len) { clearInterval(beatTimer); rest(); }
              }, 1000 / fps);
            }
            rest();
          }
          if (typeof opts.onPack === 'function') { try { opts.onPack(meta, api); } catch (e) {} }
        }).catch(function (e) {
          if (global.console) console.warn('[бирюзик] strip не загрузился:', e.message);
        });
    }

    // opts.image — прямой путь к картинке; opts.pack — папка. Форматы пака:
    //  • frames.json      — directional спрайт (8 ракурсов, ходьба по направлениям);
    //  • pack.json+sprite — одиночный цикл (anim.json+strip), наш конвейер → loadStrip;
    //  • pack.json+static — одна картинка-эталон.
    if (opts.image) loadStatic(opts.image);
    else if (opts.pack) {
      var proot = String(opts.pack).replace(/\/$/, '');
      if (global.fetch) {
        fetch(proot + '/frames.json', { method: 'HEAD' }).then(function (r) {
          if (r.ok) { loadPack(opts.pack); return; }
          return fetch(proot + '/pack.json').then(function (r2) { return r2.ok ? r2.json() : null; })
            .then(function (m) {
              // имя из пака: скин обязан представляться собой, а не Бирюзиком
              if (m && (m.name || m.displayName)) applyIdentity(m.name || m.displayName, m.name_en || m.displayName);
              // реестр состояний: без него нарисованные walk и действия лежат в канале мёртвым
              // грузом — переключиться на них было физически нечем
              if (m && m.states) {
                packRoot = proot; packStates = m.states;
                curState = primaryState = m.primary || 'idle';
              }
              // ХАРАКТЕР ПИТОМЦА задаётся паком, а не движком: у толстого кота свой аппетит,
              // у робота его нет вовсе. Аппетит ускоряет убывание сытости, привычки заставляют
              // питомца сам собой делать что-то раз в N секунд.
              if (m && m.persona) startPersona(m.persona);
              // ЯКОРЯ АКСЕССУАРОВ — куда садятся колпак, очки и шарф ИМЕННО У ЭТОГО скина.
              // Проценты 0..100 от кадра: у кота макушка между ушами, у робота на верху шара.
              // Без них один набор координат на всю колоду сажал бы предмет мимо головы —
              // ровно эта жалоба и пришла от PsyGames (задача d54ffc83).
              if (m && m.anchors) anchors = m.anchors;
              // АРХЕТИП пака решает, какими приёмами он растёт: зверю блеск, роботу подсветка,
              // старцу ореол и отрыв от земли. Одна механика на всех дала бы кота с лампочками.
              if (m && m.growth && m.growth.style) lookStyle = m.growth.style;
              if (m && m.growth && m.growth.forms) packForms = m.growth.forms;
              // Пак может задать свою лестницу роста: growth.unlocks = [{level,item,anchor}].
              // Старцу подходят шапка мудреца и чётки, коту — бант; общий список тут ни при чём.
              if (m && m.growth && m.growth.unlocks && global.__ODVMASCOT)
                global.__ODVMASCOT.unlocks = m.growth.unlocks;
              // Догоняем уже заработанное: человек мог поднять уровень в прошлый визит.
              if (global.__ODVMASCOT && global.__ODVMASCOT.applyUnlocks)
                setTimeout(global.__ODVMASCOT.applyUnlocks, 60);
              // фразы из сервиса — уже с настоящим именем питомца
              if (opts.linesBase) loadServiceLines(opts.linesBase, opts.lang, opts.lang === 'ru' ? (m && m.name) : (m && (m.name_en || m.name)));
              if (m && m.sprite && m.sprite.sheet && m.sprite.frames)
                loadStrip(proot + '/' + m.sprite.sheet, proot + '/' + m.sprite.frames);
              else if (m && m.engine === 'static' && m.image) loadStatic(proot + '/' + m.image);
              else if (m && m.image) loadStatic(proot + '/' + m.image);
              else if (m && m.sprite) loadPack(proot + '/' + m.sprite.frames.replace(/\/[^/]*$/, ''));
            });
        }).catch(function () { loadPack(opts.pack); });
        // страховка: пак мог не ответить вовсе — тогда через пару секунд показываем встроенного,
        // иначе на месте питомца останется пустота
        setTimeout(function () {
          if (alive && willHaveSkin && !pet.querySelector('.bz-skin') && !pet.querySelector('.bz-char')) {
            pet.insertAdjacentHTML('afterbegin', characterSVG(ns));
          }
        }, 2500);
      } else loadPack(opts.pack);
    }

    // Позицию отдаём наружу вместо сдвига внутри страницы (оболочка двигает окно).
    // ⚠️ Имя НЕ onMove: так звался внутренний обработчик перетаскивания, и `var onMove`
    // затирал его ДО регистрации слушателя — addEventListener('pointermove', null)
    // молча не вешал ничего, перетаскивание переставало работать без единой ошибки.
    var moveOut = typeof opts.onMove === 'function' ? opts.onMove : null;
    var lastSent = null;

    function place() {
      if (moveOut) {
        var key = Math.round(x) + ':' + Math.round(y);
        if (key !== lastSent) { lastSent = key; moveOut(Math.round(x), Math.round(y)); }
      } else if (!mounted) {
        // инлайн-режим: питомец отцентрован в своей коробке (margin auto), оконными
        // координатами его НЕ двигаем — иначе уезжает из ячейки к центру экрана.
        host.style.transform = 'translate3d(' + x + 'px,' + (-y) + 'px,0)';
      }
      // со скином переворачивает себя сам спрайт (зеркальные направления),
      // иначе зеркалили бы дважды
      pet.style.transform = pack ? 'none' : 'scaleX(' + dir + ')';
      // пузырь не переворачиваем вместе с персонажем
      bubble.style.transform = 'translate(-50%,' + (bubble.classList.contains('on') ? '-12px' : '-6px') + ') scaleX(' + (pack ? 1 : dir) + ')';
    }

    function say(text, ms) {
      wake();
      bubble.textContent = text;
      bubble.classList.add('on');
      place();
      bubbleUntil = performance.now() + (ms || 2600);
    }

    function pickTarget(now) {
      if (frozen) return;  // дело стоит — питомец никуда не идёт
      stopIdle();          // маршрут важнее простоя
      var span = maxX();
      var t = Math.round(Math.random() * span);
      // не топтаться на месте — уходим хотя бы на 15% ширины
      if (Math.abs(t - x) < span * 0.15) t = (t + span * 0.45) % span;
      target = t;
      // в режиме roam питомец гоняет по всей площади, а не только по нижней кромке
      targetY = roam ? Math.round(Math.random() * maxY()) : 0;
      dir = target >= x ? 1 : -1;
      mode = 'walk';
      pet.className = 'bz-pet walk';
      nextDecision = now + 6000 + Math.random() * 6000;
    }

    // ── БОГАТЫЕ ПРОСТОИ (паттерн oneko): в покое питомец не «стоит истуканом»,
    // а иногда зевает, чешется, потягивается. У края экрана — царапает стену.
    var IDLES = [
      { anim: 'bzYawn 1.9s ease-in-out', ms: 1900 },
      { anim: 'bzScratch 1.5s ease-in-out', ms: 1500 },
      { anim: 'bzStretch 1.7s ease-in-out', ms: 1700 },
      { anim: 'bzGroom 2.1s ease-in-out', ms: 2100 }
    ];
    var EDGE_IDLE = { anim: 'bzEdge 1.6s ease-in-out', ms: 1600 };
    var actUntil = 0;
    var nextIdle = 0;

    function playIdle(now) {
      // у самой стенки — не зевать, а царапать её: реакция на место, а не рандом
      var atLeft = x <= 4, atRight = x >= maxX() - 4;
      var pick;
      if (atLeft || atRight) {
        pick = EDGE_IDLE;
        pet.style.setProperty('--bz-wall', atLeft ? -1 : 1);
        applyDir(atLeft ? 'w' : 'e');
      } else {
        pick = IDLES[Math.floor(Math.random() * IDLES.length)];
      }
      pet.style.setProperty('--bz-act', pick.anim);
      pet.classList.add('act');
      actUntil = now + pick.ms;
      nextIdle = actUntil + 3500 + Math.random() * 7000;
    }

    function stopIdle() {
      actUntil = 0;
      pet.classList.remove('act');
    }

    function rest(now) {
      mode = 'idle';
      pet.className = 'bz-pet idle';
      if (!nextIdle) nextIdle = now + 2500 + Math.random() * 5000;
      applyDir('s');            // остановился — повернулся к человеку
      nextDecision = now + 1600 + Math.random() * 3200;
      // chatter:false — питомец не болтает случайными репликами. Нужно там, где он
      // что-то ОЗНАЧАЕТ (в стае — проект): «Нажми, покажу фокус» рядом с блокером
      // сбивает чтение состояния.
      if (chatter && Math.random() < 0.55) say(lines[Math.floor(Math.random() * lines.length)]);
    }

    function sleep(now) {
      if (asleep) return;
      stopIdle();
      asleep = true;
      mode = 'sleep';
      pet.className = 'bz-pet sleep';
      // «zZz» показываем через пузырь — у него уже есть контр-разворот при флипе персонажа
      bubble.textContent = 'zZz';
      bubble.classList.add('on');
      bubbleUntil = 0;   // висит до пробуждения
      place();
      persist();
    }

    function wake(now) {
      idleSince = now == null ? performance.now() : now;
      // замороженного будить нельзя: его состояние пришло из данных (в стае — «дело стоит»),
      // а не от скуки. Иначе достаточно провести мышью — и индикатор соврёт.
      if (frozen) return;
      if (!asleep) return;
      asleep = false;
      mode = 'idle';
      pet.className = 'bz-pet idle';
      bubble.classList.remove('on');
      bubbleUntil = 0;
      nextDecision = idleSince + 900;
      place();
      persist();
    }

    function update(now) {
      if (!last) last = now;
      var dt = Math.min(64, now - last) / 1000;
      last = now;

      // печать закончилась → обратно в покой
      if (mode === 'type' && now > typingUntil) rest(now);

      // режим следования: цель — курсор (паттерн oneko), мёртвая зона чтобы не дрожал
      if (follow && pointerX != null && !asleep && mode !== 'type') {
        var want = Math.max(0, Math.min(maxX(), pointerX - size / 2));
        if (Math.abs(want - x) > size * 0.35) {
          target = want;
          dir = target >= x ? 1 : -1;
          if (mode !== 'walk') { mode = 'walk'; pet.className = 'bz-pet walk'; }
          idleSince = now;
        }
      }

      if (mode === 'fall') {
        // бросили в воздухе — падает с ускорением и приземляется
        vyFall += 1500 * dt;
        y -= vyFall * dt;
        idleSince = now;
        if (y <= 0) { y = 0; vyFall = 0; rest(now); greet(); }   // приземлился рядом — здоровается
      } else if (mode === 'walk') {
        // движение вектором: по нижней кромке (targetY=0) или по всей площади в roam
        var vx = target - x, vy = targetY - y;
        var dist = Math.sqrt(vx * vx + vy * vy);
        // вялый когда голоден/вымотан, бодрый когда всё хорошо
        var stepLen = speed * vigor() * dt;
        if (dist > 0) {
          dir = vx >= 0 ? 1 : -1;
          applyDir(dirName(vx, -vy));   // y растёт вверх, у экрана — вниз
        }
        if (dist <= stepLen || dist === 0) { x = target; y = targetY; rest(now); }
        else { x += vx / dist * stepLen; y += vy / dist * stepLen; }
        x = Math.max(0, Math.min(maxX(), x));
        y = Math.max(0, Math.min(maxY(), y));
        idleSince = now;
      } else if (mode !== 'type' && !asleep) {
        if (actUntil && now > actUntil) stopIdle();
        // пока играет простой — новый маршрут не выбираем, иначе анимация обрывается
        if (!actUntil) {
          if (now > nextIdle) playIdle(now);
          else if (now > nextDecision) pickTarget(now);
        }
      }

      // покой затянулся → сон (батарея/ненавязчивость); просыпается от тапа или курсора рядом
      if (!asleep && sleepAfter > 0 && mode !== 'walk' && now - idleSince > sleepAfter) sleep(now);

      if (bubbleUntil && now > bubbleUntil) {
        bubbleUntil = 0;
        // возвращаем постоянный признак: у замороженного — его метка (⛔), у спящего — «zZz».
        // Реплика поверх них затирала признак навсегда.
        if (frozen) { bubble.textContent = frozenText || '⛔'; }
        else if (asleep) { bubble.textContent = 'zZz'; }
        else bubble.classList.remove('on');
      }

      // раз в 2 сек: потребности живут своей жизнью + сохранение (localStorage синхронный)
      if (!saveTimer) saveTimer = now;   // первый кадр — не считать «время с эпохи» за простой
      if (now - saveTimer >= 2000) {
        // считаем по фактически прошедшему времени: в фоновой вкладке rAF редкий,
        // фиксированный шаг занижал бы убывание
        var hours = Math.min(1, (now - saveTimer) / 3600000);
        saveTimer = now;
        if (!autoCare) { /* состоянием владеет адаптер — не трогаем */ }
        else if (asleep) care.energy = clamp100(care.energy + 25 * hours);  // сон восстанавливает силы
        else decay(hours);
        // сильный голод/усталость сам просится вслух, но не чаще раза в минуту
        if (chatter && !asleep && now - lastNag > 60000 && (care.fullness < 22 || care.energy < 18 || care.mood < 20)) {
          lastNag = now;
          say(needLine(), 3200);
        }
        persist();
      }

      place();
    }

    // rAF-цикл. В скрытой вкладке браузер его замораживает — это правильно
    // (не жжём батарею), поэтому для хост-driven тика и тестов есть api.step().
    function frame(now) {
      if (!alive) return;
      update(now);
      raf = requestAnimationFrame(frame);
    }
    var synth = null;

    // взгляд за курсором
    function look(e) {
      if (typeof e.clientX !== 'number') return;
      pointerX = e.clientX;
      var r = pet.getBoundingClientRect();
      // курсор подошёл близко — будим
      if (asleep && Math.abs(e.clientX - (r.left + r.width / 2)) < 170) wake();
      var dx = Math.max(-5, Math.min(5, (e.clientX - (r.left + r.width / 2)) / 42));
      var dy = Math.max(-4, Math.min(4, (e.clientY - (r.top + r.height / 2)) / 42));
      for (var i = 0; i < tracks.length; i++) {
        tracks[i].style.setProperty('--bz-x', dx.toFixed(2) + 'px');
        tracks[i].style.setProperty('--bz-y', dy.toFixed(2) + 'px');
      }
    }
    document.addEventListener('pointermove', look, { passive: true });

    // ── ЗВУК: короткий щелчок без ассетов (WebAudio), по умолчанию выключен.
    var soundOn = !!opts.sound, actx = null;
    function blip(freq, dur, vol) {
      if (!soundOn) return;
      try {
        if (!actx) actx = new (global.AudioContext || global.webkitAudioContext)();
        if (actx.state === 'suspended') actx.resume();
        var t = actx.currentTime, o = actx.createOscillator(), g = actx.createGain();
        o.type = 'triangle';
        o.frequency.setValueAtTime(freq, t);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(vol, t + 0.006);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g); g.connect(actx.destination);
        o.start(t); o.stop(t + dur + 0.02);
      } catch (e) {}
    }

    // ── РЕАКЦИЯ НА ВВОД (паттерн BongoCat): лапы стучат в такт твоим клавишам.
    // В вебе слушаем страницу; в приложении глобальные клавиши ОС прилетают
    // из native-слоя в тот же api.typing().
    var typingUntil = 0, lastKey = 0, typedMs = 0;
    // единые часы: при хост-driven тике (api.step) время синтетическое —
    // иначе ввод и цикл жили бы по разным таймлайнам и питомец «засыпал» на лету
    function clock() { return synth == null ? performance.now() : synth; }
    function typing() {
      var now = clock();
      stopIdle();          // человек печатает — не время зевать
      var gap = now - lastKey;
      lastKey = now;
      if (asleep) wake(now);
      // темп лап = ритм клавиш, зажат в рамки, чтобы не мельтешил и не залипал
      var tempo = Math.max(180, Math.min(680, gap)) / 2000;
      pet.style.setProperty('--bz-tempo', tempo.toFixed(3) + 's');
      if (mode !== 'type') { mode = 'type'; pet.className = 'bz-pet type'; }
      typingUntil = now + 900;
      idleSince = now;
      blip(520 + Math.random() * 220, 0.05, 0.045);
      // совместная работа поднимает настроение, но по времени — не гриндом клавиш
      typedMs += Math.min(Math.max(gap, 0), 1500);
      if (typedMs > 30000) { typedMs = 0; gain('mood', 2); }
    }
    document.addEventListener('keydown', typing, { passive: true, capture: true });

    // прокрутка — короткая реакция телом, без болтовни
    var lastScroll = 0;
    function onScroll() {
      var now = clock();
      if (now - lastScroll < 700) return;
      lastScroll = now;
      if (asleep) wake(now);
      idleSince = now;
      pet.classList.add('tap');
      setTimeout(function () { pet.classList.remove('tap'); }, 620);
    }
    global.addEventListener('scroll', onScroll, { passive: true });

    // ── ПЕРЕТАСКИВАНИЕ. Питомца можно взять и переставить; отпущенный — падает
    // на пол (в режиме roam остаётся висеть там, где отпустили).
    var drag = null, justDragged = false, vyFall = 0;
    // Смещение, на которое человек перетащил питомца в смонтированном режиме. Двигаем сам
    // контейнер: на сайте это фиксированный слой в углу экрана, и таскать надо его целиком.
    // В ячейке витрины питомец при этом остаётся на месте, пока его не потянут рукой.
    // ⚠️ В УГЛОВОМ РЕЖИМЕ ТАЩИТЬ НАДО ХОСТ, А НЕ ПИТОМЦА ВНУТРИ НЕГО. Хост — коробка размером
    // с питомца, приклеенная к углу; двигая питомца внутри неё, сдвинуть его некуда, и
    // перетаскивание выглядело мёртвым. Поймано Денисом: «маскот на всех сайтах не тащится».
    // Поэтому в угловом режиме роль подвижного элемента играет сам host.
    var mountEl = mounted ? opts.mount : (document.getElementById("mascot-host") || null);
    // куда человек перетащил питомца в прошлый раз — возвращаем туда же, а не в угол
    var dragDX = (saved && typeof saved.dragDX === 'number') ? saved.dragDX : 0;
    var dragDY = (saved && typeof saved.dragDY === 'number') ? saved.dragDY : 0;
    function applyMountShift() {
      if (mountEl) mountEl.style.transform = 'translate3d(' + dragDX + 'px,' + dragDY + 'px,0)';
    }
    if (dragDX || dragDY) applyMountShift();

    // Смещение при перетаскивании считаем по ЭКРАННЫМ координатам, а не по оконным.
    // В десктоп-оболочке окно едет за питомцем, поэтому курсор остаётся на том же
    // месте внутри окна — по clientX смещение выходило бы нулевым и питомец залипал бы в руке.
    function ptr(e) {
      return { x: e.screenX != null ? e.screenX : e.clientX,
               y: e.screenY != null ? e.screenY : e.clientY };
    }

    function onDown(e) {
      if (e.button != null && e.button !== 0) return;
      var q = ptr(e);
      drag = { px: q.x, py: q.y, x0: x, y0: y, mx0: dragDX, my0: dragDY, moved: false };
      try { pet.setPointerCapture(e.pointerId); } catch (err) {}
    }
    function onDragMove(e) {
      if (!drag) return;
      var q = ptr(e);
      var dx = q.x - drag.px, dy = q.y - drag.py;
      if (!drag.moved && Math.abs(dx) + Math.abs(dy) < 5) return;   // порог, чтобы не съесть клик
      if (!drag.moved) {
        drag.moved = true;
        stopIdle();
        wake();
        mode = 'drag';
        pet.className = 'bz-pet drag';
      }
      if (mountEl) {
        var box = (mounted ? pet : mountEl).getBoundingClientRect();
        // где питомец оказался бы БЕЗ текущего смещения — от этого и считаем границы,
        // чтобы его нельзя было утащить за край окна и потерять
        var baseLeft = box.left - dragDX, baseTop = box.top - dragDY;
        var pad = 8, vw = window.innerWidth, vh2 = window.innerHeight;
        dragDX = drag.mx0 + dx;
        dragDY = drag.my0 + dy;
        // Границы применяем ТОЛЬКО когда размеры окна известны. В скрытой вкладке и до первой
        // раскладки браузер отдаёт 0 — и ограничение из осмысленного превращалось в телепорт
        // питомца в противоположный угол (поймал на своей же проверке).
        if (vw > 0 && vh2 > 0) {
          dragDX = Math.max(pad - baseLeft, Math.min(dragDX, vw - box.width - pad - baseLeft));
          dragDY = Math.max(pad - baseTop, Math.min(dragDY, vh2 - box.height - pad - baseTop));
        }
        applyMountShift();
        // Питомца передвинули руками — угловая раскладка больше им не распоряжается.
        // Иначе реестр углов или обход чужих виджетов вернут его обратно на следующем же
        // пересчёте, и человек решит, что перетаскивание не работает.
        //
        // ⚠️ Условие «!mounted» здесь НЕ РАБОТАЕТ и работать не может: приёмник монтирует
        // питомца в свой угловой host, то есть mounted всегда true. Сигнал шлём ВСЕГДА,
        // а решает приёмник — он один знает, его это host или чужой контейнер сайта.
        if (window.__mascotManual !== true) {
          window.__mascotManual = true;
          try { window.dispatchEvent(new CustomEvent("mascot:manual-move")); } catch (e2) {}
        }
      } else {
        x = Math.max(0, Math.min(maxX(), drag.x0 + dx));
        y = Math.max(0, Math.min(roam ? maxY() : vh(), drag.y0 - dy));
      }
      applyDir('s');
      place();
    }
    function onUp(e) {
      if (!drag) return;
      var moved = drag.moved;
      drag = null;
      try { pet.releasePointerCapture(e.pointerId); } catch (err) {}
      if (!moved) return;
      justDragged = true;
      setTimeout(function () { justDragged = false; }, 0);   // гасим клик после перетаскивания
      idleSince = clock();
      gain('mood', 3);          // внимание есть внимание
      // В смонтированном режиме падения НЕТ: человек поставил питомца в угол — он там и
      // остаётся. Ронять его обратно вниз значит отменять действие пользователя (питомец
      // уезжал сразу после того, как его перетащили).
      if (mounted || roam || y <= 0) { rest(clock()); greet(); }
      // в воздухе здороваться рано — поздороваемся, когда приземлимся рядом
      else { mode = 'fall'; vyFall = 0; pet.className = 'bz-pet fall'; }
    }
    pet.addEventListener('pointerdown', onDown);
    pet.addEventListener('pointermove', onDragMove);
    pet.addEventListener('pointerup', onUp);
    pet.addEventListener('pointercancel', onUp);

    /** Поставили рядом с другим питомцем — здороваются и поворачиваются друг к другу. */
    function greet() {
      for (var i = 0; i < PETS.length; i++) {
        var other = PETS[i];
        if (other === api || !other._near) continue;
        // призрак: хост выкинули из документа мимо destroy() — соседом не считаем
        if (!other.el || !other.el.isConnected) continue;
        if (Math.abs(other.x() - x) < size * 1.4 && Math.abs(other.y() - y) < size) {
          applyDir(other.x() > x ? 'e' : 'w');
          say('Привет, сосед! 👋', 2200);
          other._near(x);
          gain('mood', 4);
          return;
        }
      }
    }

    function tap() {
      if (justDragged) return;
      wake();
      blip(680, 0.09, 0.06);
      pet.classList.add('tap');
      setTimeout(function () { pet.classList.remove('tap'); }, 620);
      // внимание = настроение; если сильно голоден — скажет об этом, а не отшутится
      var grew = gain('mood', 6);
      if (chatter) {
        say(grew ? '🎉 Уровень ' + care.level + '!'
                 : (care.fullness < 22 || care.energy < 18) ? needLine()
                 : lines[Math.floor(Math.random() * lines.length)], 2400);
      }
      if (typeof opts.onClick === 'function') { try { opts.onClick(api); } catch (e) {} }
    }
    pet.addEventListener('click', tap);
    pet.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); tap(); }
    });

    if (!reduceMotion) raf = requestAnimationFrame(frame);
    else { place(); say(lines[0], 4000); }

    var api = {
      version: VERSION,
      el: host,
      say: function (t, ms) { say(t, ms); return api; },
      x: function () { return Math.round(x); },
      mode: function () { return mode; },
      isAsleep: function () { return asleep; },
      sleep: function () { sleep(performance.now()); return api; },
      wake: function () { wake(); return api; },
      follow: function (on) { follow = on !== false; return api; },

      // Переключить состояние пака: .state('walk') — пойти боком, .state() — узнать текущее.
      //
      // Раньше движок умел показывать РОВНО ОДНО состояние: то, на которое указывал sprite в
      // манифесте. Всё остальное — боковая ходьба зверей, девять действий Бирюзика — лежало в
      // канале мёртвым грузом, потому что переключиться на него было нечем. Здесь это и чинится.
      //
      // Возврат: true если состояние есть и переключение началось, false если такого нет —
      // молча падать в покой нельзя, вызывающий должен знать, что состояние не поехало.
      state: function (name) {
        if (name == null) return curState;
        if (!packStates || !packRoot) return false;
        // Имя разрешаем и коротким: действия зарегистрированы как 'actions/angry', но снаружи
        // естественно звать их 'angry'. Требовать полный путь — значит заставлять сайт знать
        // внутреннюю раскладку папок пака (баг поймал grovi-codex-mac: state('angry') → false).
        var rel = packStates[name];
        if (!rel) {
          for (var key in packStates) {
            if (key === name || key.slice(-(name.length + 1)) === '/' + name) { rel = packStates[key]; name = key; break; }
          }
        }
        if (!rel) return false;
        if (name === curState) return true;
        curState = name;
        var dir = rel.replace(/\/[^/]*$/, '');
        // старый интервал гасится внутри loadStrip — иначе два цикла крутили бы кадры вперемешку
        loadStrip(packRoot + '/' + dir + '/walk-strip.png', packRoot + '/' + rel);
        return true;
      },

      // Какие состояния у этого пака вообще есть — сайту нужно знать, что предлагать.
      states: function () { return packStates ? Object.keys(packStates) : []; },

      // Сцена нижним слоем: .scene('litter') или .scene(url). Пустой аргумент — убрать.
      scene: function (nameOrUrl) {
        if (!nameOrUrl) { stopScene(); return api; }
        playScene(layerUrl(nameOrUrl, 'scenes'));
        return api;
      },

      // Эффект вторым слоем: .effect('hearts') или .effect(url). Пустой аргумент — снять.
      // Имя разворачивается в папку канала, поэтому один добытый эффект доступен любому скину.
      effect: function (nameOrUrl, durationMs) {
        if (!nameOrUrl) { stopEffect(); return api; }
        playEffect(layerUrl(nameOrUrl, 'effects'), durationMs);
        return api;
      },

      // ── реакция на ввод и звук
      typing: function () { typing(); return api; },
      sound: function (on) { soundOn = on !== false; return api; },
      isTyping: function () { return mode === 'type'; },
      isDragging: function () { return !!(drag && drag.moved); },

      // ── петля заботы
      setStats: function (patch) {
        for (var k in patch) if (care[k] != null && typeof patch[k] === 'number') care[k] = clamp100(patch[k]);
        persist();
        return api;
      },
      label: function (text) {
        var el2 = pet.querySelector('.bz-label');
        if (!el2) { el2 = document.createElement('div'); el2.className = 'bz-label'; pet.appendChild(el2); }
        el2.textContent = text;
        return api;
      },
      stats: function () { return { energy: Math.round(care.energy), fullness: Math.round(care.fullness), mood: Math.round(care.mood), xp: care.xp, level: care.level }; },
      feed: function (amount) {
        wake();
        var grew = gain('fullness', amount == null ? 28 : amount);
        care.mood = clamp100(care.mood + 5);
        say(grew ? '🎉 Уровень ' + care.level + '!' : 'Ммм, спасибо! 😋', 2400);
        return api;
      },
      play: function (amount) {
        wake();
        var grew = gain('mood', amount == null ? 18 : amount);
        care.energy = clamp100(care.energy - 8);   // веселье выматывает
        care.fullness = clamp100(care.fullness - 4);
        api.goTo(Math.random() * maxX());
        say(grew ? '🎉 Уровень ' + care.level + '!' : 'Ура, играем! 🎾', 2400);
        return api;
      },
      step: function (ms) { synth = (synth == null ? (last || performance.now()) : synth) + (ms || 16); update(synth); return api; },
      y: function () { return Math.round(y); },
      /** Заморозить: питомец замирает и не просыпается от мыши. Для состояний из данных. */
      freeze: function (on, text) {
        frozen = on !== false;
        if (frozen) {
          sleep(clock());
          pet.classList.add('frozen');
          frozenText = text || '';
        if (text) { bubble.textContent = text; bubble.classList.add('on'); bubbleUntil = 0; }
        } else {
          pet.classList.remove('frozen');
          wake(clock());
        }
        return api;
      },
      isFrozen: function () { return frozen; },
      /** Переставить мгновенно, без ходьбы — для раскладки группы. */
      placeAt: function (px, py) {
        x = Math.max(0, Math.min(maxX(), px));
        if (py != null) y = Math.max(0, Math.min(maxY(), py));
        target = x; targetY = y;
        place();
        return api;
      },
      goTo: function (px, py) {
        target = Math.max(0, Math.min(maxX(), px));
        // без второго аргумента идём по своей высоте, а не сбрасываем её в пол
        targetY = py == null ? y : Math.max(0, Math.min(maxY(), py));
        dir = target >= x ? 1 : -1;
        mode = 'walk';
        pet.className = 'bz-pet walk';
        return api;
      },
      destroy: function () {
        alive = false;
        var at = PETS.indexOf(api);
        if (at >= 0) PETS.splice(at, 1);
        persist();
        if (raf) cancelAnimationFrame(raf);
        document.removeEventListener('pointermove', look);
        document.removeEventListener('keydown', typing, true);
        global.removeEventListener('scroll', onScroll);
        if (host.parentNode) host.parentNode.removeChild(host);
      }
    };
    // ══════════════════════════════════════════════════════════════════════════════════════
    // ВНЕШНОСТЬ ПО УРОВНЮ. Решение Дениса 16.08.2026: эволюция — это НЕ увеличение размера.
    // Его формулировка: «рост — механика для котят; старцу и роботу нужна либо эволюция, либо
    // тюнинг», с отсылкой к стадиям Гоку. Суть приёма: СИЛУЭТ НЕ МЕНЯЕТСЯ, меняется состояние —
    // аура, свет, цвет. Отсюда всё ниже делается фильтрами и слоями поверх готовых кадров,
    // без единого нового файла.
    //
    // ⚠️ ОДНА МЕХАНИКА НА ВСЮ КОЛОДУ НЕ ГОДИТСЯ. Кот с лампочками и «причёсанный» робот —
    // одинаково плохо. Поэтому набор приёмов выбирается по АРХЕТИПУ пака (growth.style),
    // а не применяется всем подряд.
    var LOOK = {
      beast:  { gloss: true },                              // зверь: от тусклого к лоснящемуся
      sage:   { aura: '255,196,84',  levitate: true },      // старец: золотой ореол, отрыв от земли
      tech:   { aura: '120,210,255', tune: true },          // техника: подсветка и маячок
      spirit: { aura: '185,140,255', levitate: true }       // дух: холодное свечение
    };
    var lookStyle = null;                                    // приходит из pack.json → growth.style

    /** Применить внешность уровня. tier 0..3 — четыре ступени, дальше не растём. */
    function applyLook(level) {
      if (!skin) return;
      var L = LOOK[lookStyle] || {};
      var tier = (global.__ODVMASCOT && global.__ODVMASCOT.tierOf) ? global.__ODVMASCOT.tierOf(level) : 0;
      var p = tier / 4;
      var f = [];
      // УХОЖЕННОСТЬ: насыщенность и контраст. Читается как «за питомцем следят», а не как
      // «его перекрасили» — поэтому шаг маленький, до +45% цвета на верхней ступени.
      if (L.gloss && tier) f.push('saturate(' + (1 + 0.45 * p).toFixed(2) + ')',
                                  'contrast(' + (1 + 0.22 * p).toFixed(2) + ')');
      // АУРА: свечение ПО КОНТУРУ через drop-shadow. Именно drop-shadow, а не box-shadow и не
      // подложка: он повторяет альфу спрайта, поэтому светится сам персонаж, а не его рамка.
      if (L.aura && tier) {
        var c = L.aura;
        f.push('drop-shadow(0 0 ' + (5 + 9 * p).toFixed(0) + 'px rgba(' + c + ',' + (0.5 * p + 0.3).toFixed(2) + '))');
        if (tier >= 2) f.push('drop-shadow(0 0 ' + (14 + 20 * p).toFixed(0) + 'px rgba(' + c + ',' + (0.35 * p).toFixed(2) + '))');
      }
      skin.style.filter = f.join(' ');
      // ЛЕВИТАЦИЯ: отрыв от земли плюс поджатая тень. Трансформ НЕ используем — у strip-скина
      // стоит transform:none!important (иначе процедурные анимации крутят растровые кадры),
      // поэтому поднимаем отступом. Тень обязана съёжиться, иначе полёт не читается.
      var lift = L.levitate ? Math.round(10 * p) : 0;
      skin.style.marginTop = lift ? (-lift) + 'px' : '';
      var sh = pet.querySelector('.bz-shadow');
      if (sh) {
        sh.style.width = (62 - 18 * (lift ? p : 0)) + '%';
        sh.style.opacity = lift ? String(1 - 0.45 * p) : '';
      }
      // ТЮНИНГ ТЕХНИКИ: маячок на макушке. Рисуется кодом — градиент и пульс, ни одного файла.
      // Роботу неуместен «блеск шерсти», ему уместен апгрейд, поэтому механика отдельная.
      if (L.tune) {
        var b = pet.querySelector('.bz-beacon');
        if (tier && !b && anchors && anchors.head_top) {
          b = document.createElement('div');
          b.className = 'bz-beacon';
          b.style.cssText = 'position:absolute;pointer-events:none;z-index:4;width:9%;height:9%;' +
            'border-radius:50%;transform:translate(-50%,-50%);' +
            'left:' + anchors.head_top.x + '%;top:' + (anchors.head_top.y - 3) + '%;' +
            'background:radial-gradient(circle,rgba(' + L.aura + ',1) 0%,rgba(' + L.aura + ',0) 70%);' +
            'animation:bzBeacon 1.6s ease-in-out infinite';
          skin.appendChild(b);
        }
        if (b) { b.style.opacity = String(0.35 + 0.65 * p); if (!tier) b.style.opacity = '0'; }
      }

      // ГЛАЗА. Предложение Дениса: «по идее глаза и причёска ещё можно». Причёску на растровом
      // кадре не переделать без пересъёмки, а ГЛАЗА — можно: светящееся пятно по якорю eyes.
      // У Гоку смена цвета глаз и есть половина эффекта формы.
      if (L.aura && anchors && anchors.eyes) {
        var ey = pet.querySelector('.bz-eyes');
        if (tier >= 2 && !ey) {
          ey = document.createElement('div');
          ey.className = 'bz-eyes';
          ey.style.cssText = 'position:absolute;pointer-events:none;z-index:2;mix-blend-mode:screen;' +
            'width:34%;height:12%;transform:translate(-50%,-50%);border-radius:50%;' +
            'left:' + anchors.eyes.x + '%;top:' + anchors.eyes.y + '%;' +
            'background:radial-gradient(ellipse,rgba(' + L.aura + ',.85) 0%,rgba(' + L.aura + ',0) 72%);' +
            'animation:bzBeacon 2.4s ease-in-out infinite';
          skin.appendChild(ey);
        }
        if (ey) ey.style.opacity = tier >= 2 ? String(0.45 + 0.55 * p) : '0';
      }

      // ФОРМА: имя приходит вместе с видом, одним событием — в этом весь приём.
      var forms = (packForms || (global.__ODVMASCOT && global.__ODVMASCOT.FORMS[lookStyle]) || null);
      if (forms && forms[tier]) {
        var full = baseName ? (baseName + ' · ' + forms[tier]) : forms[tier];
        pet.setAttribute('aria-label', full);
        pet.setAttribute('title', full);
        // ФОРМА СМЕНИЛАСЬ — показываем карточку. Только в этот момент: постоянной панели нет,
        // а именно на повышении человеку и интересно, что он получил.
        if (curForm && forms[tier] !== curForm && shownForm !== forms[tier]) {
          shownForm = forms[tier];
          try { showCard(global.__ODVMASCOT.growth(), forms[tier]); } catch (e) {}
        }
        curForm = forms[tier];
      }
      try { drawRing(global.__ODVMASCOT.growth()); } catch (e) {}

      // ПОВАДКИ: уровень меняет не только вид. Питомец становится ЖИВЕЕ — реагирует чаще и
      // отходит дальше. Это единственная механика роста, которую нельзя украсть по скриншоту.
      liveliness = 1 + 0.6 * p;
      wakeDormant(tier);
      // ФРАЗЫ: с уровнем питомец говорит и то, что положено его форме. Реплики про форму
      // добавляются к обычным, а не заменяют их — тон сайта остаётся прежним.
      if (curForm && lineForForm[curForm] && lines.indexOf(lineForForm[curForm]) < 0)
        lines = lines.concat([lineForForm[curForm]]);
    }

    /** Надеть предмет по якорю пака. _wear(null) — снять всё (сброс прогресса).
     *
     * Предмет — отдельный слой ПОВЕРХ кадров, а не вшитый в них: иначе каждое сочетание
     * «скин × предмет» пришлось бы рисовать заново, то есть 34 × 24 набора.
     * Кладём в .bz-skin, а не в skinImg: у skinImg собственный transform под зеркало
     * направления, и предмет унаследовал бы его вместе с переворотом.
     */
    api._wear = function (item, anchorName, size, dx, dy) {
      if (!skin) return api;
      if (!item) {                                   // снять всё
        Object.keys(gearEl).forEach(function (k) {
          if (gearEl[k] && gearEl[k].parentNode) gearEl[k].parentNode.removeChild(gearEl[k]);
        });
        gearEl = {};
        return api;
      }
      var a = (anchors && anchors[anchorName]) || null;
      // Якорей нет — предмет не надеваем ВОВСЕ. Посадить «примерно на глаз» хуже, чем не
      // надеть: на роботе и Нейроне именно так аксессуары и съезжали, за это PsyGames и
      // заплатил очками игроков.
      if (!a) return api;
      // ⚠️ КЛЮЧ — ПРЕДМЕТ, А НЕ ЯКОРЬ. Держал по якорю, и на седьмом уровне нимб ВЫТЕСНИЛ шапку
      // мудреца: оба садятся на head_top, слой был один. Рост обязан накапливаться, а не
      // подменять — иначе человек получает не награду, а обмен одной вещи на другую.
      var el = gearEl[item];
      if (!el) {
        el = document.createElement('div');
        el.className = 'bz-gear';
        el.style.cssText = 'position:absolute;pointer-events:none;z-index:2;' +
          'background-repeat:no-repeat;background-position:center;background-size:contain;' +
          'transform:translate(-50%,-50%);transition:opacity .35s ease';
        el.style.opacity = '0';
        gearEl[item] = el;
        // проявляем через кадр — чтобы появление предмета читалось как событие, а не как рывок
        setTimeout(function () { el.style.opacity = '1'; }, 30);
      }
      // ⚠️ СЛОЙ СКИНА ПЕРЕСОЗДАЁТСЯ ПРИ КАЖДОЙ СМЕНЕ СОСТОЯНИЯ (loadStrip удаляет прежний .bz-skin
      // и вставляет новый). Предмет, положенный внутрь старого слоя, уезжает вместе с ним в
      // небытие, а gearEl продолжает на него ссылаться — и новый уже не создаётся, потому что
      // «он же есть». Поймал живьём на fydao: чётки числились надетыми, а на экране их не было.
      // Поэтому привязку проверяем КАЖДЫЙ раз и при нужде перевешиваем в текущий слой.
      if (el.parentNode !== skin) {
        skin.appendChild(el);
        if (el.style.opacity === '0') setTimeout(function () { el.style.opacity = '1'; }, 30);
      }
      // ⚠️ РАЗМЕР ЗАДАЁТ ПРЕДМЕТ, А НЕ ЯКОРЬ. Одна формула на всё дала чётки во всё лицо:
      // ожерелье и шарф занимают на шее РАЗНУЮ долю, и «42% кадра для всего, что на шее» —
      // это не правило, а совпадение. Поэтому size приходит из лестницы роста пака, а
      // значения ниже — только запасной случай, когда пак его не задал.
      var scale = (a.scale || 1) * (size || (anchorName === 'head_top' ? 0.44
                                           : anchorName === 'eyes' ? 0.38 : 0.24));
      el.style.width  = (scale * 100) + '%';
      el.style.height = (scale * 100) + '%';
      // Сдвиг предмета от якоря, в процентах кадра. Нужен, когда предмет не «садится НА»
      // точку, а висит рядом: нимб парит НАД головой, и без dy он лёг бы на макушку короной.
      el.style.left   = (a.x + (dx || 0)) + '%';
      el.style.top    = (a.y + (dy || 0)) + '%';
      if (a.rotate) el.style.transform = 'translate(-50%,-50%) rotate(' + a.rotate + 'deg)';
      el.style.backgroundImage = 'url("' + (opts.gearBase || '') + item + '.png")';
      return api;
    };

    /** Кольцо прогресса вокруг питомца: доля до следующего уровня. */
    function drawRing(g) {
      if (!skin) return;
      var L = LOOK[lookStyle] || {};
      var col = L.aura || '217,169,104';
      var box = Math.round(skin.getBoundingClientRect().height || 150);
      if (!box) return;
      var ring = pet.querySelector('.bz-ring');
      if (!ring) {
        ring = document.createElement('div');
        ring.className = 'bz-ring';
        pet.insertBefore(ring, pet.firstChild);
      }
      var side = Math.round(box * 1.06);
      ring.style.width = side + 'px';
      ring.style.height = side + 'px';
      // Доля считается ВНУТРИ уровня, а не от нуля: иначе на девятом уровне кольцо почти полное
      // всегда и перестаёт что-либо сообщать.
      var steps = (global.__ODVMASCOT && global.__ODVMASCOT.STEPS) || [0];
      var from = steps[Math.max(0, g.level - 1)] || 0;
      var to = steps[Math.min(steps.length - 1, g.level)] || (from + 1);
      var p = g.level >= steps.length ? 1 : Math.max(0, Math.min(1, (g.xp - from) / (to - from)));
      var deg = Math.round(p * 360);
      ring.style.background = 'conic-gradient(rgba(' + col + ',.95) 0deg,rgba(' + col + ',.95) ' +
        deg + 'deg,rgba(140,132,118,.16) ' + deg + 'deg,rgba(140,132,118,.16) 360deg)';
    }

    /** Карточка новой формы: всплывает сама и уходит. Показывается ТОЛЬКО на повышении. */
    function showCard(g, form) {
      if (!pet) return;
      var L = LOOK[lookStyle] || {};
      var col = 'rgb(' + (L.aura || '217,169,104') + ')';
      var card = pet.querySelector('.bz-card');
      if (!card) {
        card = document.createElement('div');
        card.className = 'bz-card';
        pet.appendChild(card);
      }
      var steps = (global.__ODVMASCOT && global.__ODVMASCOT.STEPS) || [0];
      var to = steps[Math.min(steps.length - 1, g.level)] || g.xp;
      var left = Math.max(0, to - g.xp);
      var from = steps[Math.max(0, g.level - 1)] || 0;
      var pct = g.level >= steps.length ? 100
              : Math.round(Math.max(0, Math.min(1, (g.xp - from) / ((to - from) || 1))) * 100);
      var bars = '';
      var names = { chat: 'беседы', calc: 'расчёты', training: 'занятия', other: 'прочее' };
      var top = Object.keys(g.metrics || {}).sort(function (a, b) { return g.metrics[b] - g.metrics[a]; }).slice(0, 3);
      var maxv = top.length ? g.metrics[top[0]] : 1;
      top.forEach(function (k) {
        bars += '<i style="margin-top:5px">' + (names[k] || k) + '</i>' +
                '<u><s style="width:' + Math.round(g.metrics[k] / maxv * 100) + '%"></s></u>';
      });
      card.style.color = col;
      card.innerHTML = '<b style="color:#26241f">' + (form || ('Уровень ' + g.level)) + '</b>' +
        '<i>уровень ' + g.level + '</i>' +
        '<u><s style="width:' + pct + '%"></s></u>' +
        '<i>' + (g.level >= steps.length ? 'предел достигнут' : ('до следующей формы ' + left)) + '</i>' +
        bars;
      card.classList.add('on');
      if (cardTimer) clearTimeout(cardTimer);
      cardTimer = setTimeout(function () { if (card) card.classList.remove('on'); }, 4200);
    }

    api._look = function (level) { try { applyLook(level); } catch (e) {} return api; };

    /** РАЗБУДИТЬ СПЯЩИЕ СОСТОЯНИЯ. У паков лежат состояния, которые характер не вызывает
     *  никогда: у панды это eat и sleep, у ёжика curl, у волка howl. На первом уровне
     *  питомец их не показывает, на высоких — начинает. Ни одного нового файла: всё это
     *  давно нарисовано и раздаётся, просто было мёртвым грузом. */
    function wakeDormant(tier) {
      if (!packStates || dormantOn >= tier) return;
      dormantOn = tier;
      var all = Object.keys(packStates).filter(function (s) {
        return s !== 'idle' && s !== 'walk' && s !== primaryState;
      });
      // по одному новому состоянию на ступень, чтобы рост чувствовался постепенно
      all.slice(0, tier).forEach(function (st, i) {
        habitTimers.push(setInterval(function () {
          if (!alive || asleep || drag) return;
          actOnce(st, 4200);
        }, 70000 + i * 25000));
      });
    }
    api._form = function () { return curForm; };

    // сосед позвал — поворачиваемся к нему и отвечаем
    api._near = function (otherX) {
      stopIdle();
      wake();
      applyDir(otherX > x ? 'e' : 'w');
      say('О, привет! 🐾', 2200);
      gain('mood', 4);
    };

    PETS.push(api);
    return api;
  }

  // ══════════════════════════════════════════════════════════════════════════════════════
  // РОСТ ПИТОМЦА: опыт → уровень → ВИДИМАЯ ЭВОЛЮЦИЯ
  //
  // Заказ Дениса 15.08.2026: обобщить механику Синапса из PsyGames на все сайты. Виджеты
  // webcheck уже кормят нас событием `odv:pet-xp` {amount, metric} на каждое сообщение в чат.
  //
  // ⚠️ ЭВОЛЮЦИЯ СДЕЛАНА АКСЕССУАРАМИ, А НЕ НОВЫМИ СКИНАМИ. Заказчики просили «на уровне менять
  // скин», но это самый дорогой способ: колода 34 пака, три ступени = 68 новых наборов кадров
  // по 30–60 кредитов за ролик, причём половина попыток уходит в брак. Аксессуары дают тот же
  // видимый рост за ноль съёмки и сразу на ВСЕЙ колоде: контракт якорей head_top/eyes/neck уже
  // стоит в 31 паке из 34, а 24 предмета нарисованы под магазин PsyGames.
  //
  // ⚠️ ПРОГРЕСС ЛОКАЛЬНЫЙ, per-site и per-device. Ключ включает origin: на одном устройстве у
  // fydao и psygames свои старцы, а не общий счётчик. Сервера нет намеренно — обещать перенос
  // между устройствами, не имея его, нечестно; PsyGames предупреждает об этом прямо, и мы тоже.
  var GROWTH_KEY = 'odv_pet_growth::' + (global.location ? global.location.host : 'local');

  // ЛЕСТНИЦА — ДЕВЯТЬ УРОВНЕЙ. Решение Дениса 16.08.2026.
  //
  // ⚠️ ГЛАВНОЕ ПРАВИЛО НЕ В ЧИСЛЕ, А В ТОМ, ЧТО НА КАЖДОМ УРОВНЕ ЧТО-ТО ПРОИСХОДИТ. Если
  // ступеней внешности четыре, а уровней девять, то пять уровней — пустые цифры, и это
  // чувствуется сразу: «качаю, а ничего не меняется». После выбора Дениса у нас семь механик
  // плюс предметы, поэтому изменение есть на каждом из девяти. Карта — в GROWTH_MAP ниже.
  //
  // ⚠️ ПЕРВАЯ НАГРАДА — В ПЕРВЫЙ ВИЗИТ. Уровень 2 берётся за 20 опыта, то есть за ЧЕТЫРЕ
  // сообщения в чат. До второго уровня доживает тот, кто увидел, что уровни вообще бывают;
  // если первая ступень стоит полсотни действий, её не увидит никто.
  // Дальше кривая круче: девятый — редкость, около 120 сообщений или вдвое меньше, если
  // питомца кормят и чат, и калькулятор, и разделы сайта.
  var STEPS = [0, 20, 50, 90, 150, 230, 330, 460, 620];   // порог входа в уровень 1..9
  var MAX_LEVEL = STEPS.length;

  // Опыт только копится, назад не откатывается: наказаний за перерывы нет намеренно —
  // это виджет на сайте, а не тамагочи, и «твой питомец умер, пока тебя не было» здесь
  // означало бы, что человек больше не вернётся.
  function levelOf(xp) {
    var lvl = 1;
    for (var i = 1; i < STEPS.length; i++) if (xp >= STEPS[i]) lvl = i + 1;
    return lvl;
  }
  function needFor(lvl) { return lvl >= MAX_LEVEL ? STEPS[MAX_LEVEL - 1] : STEPS[lvl]; }

  // ТИТУЛ НАЗЫВАЕТ ФОРМУ, А НЕ РАНГ. Поправка Дениса 16.08.2026: «как у Гоку был супервоин 3,
  // потом супервоин 4 — разные формы, разные названия». Суть приёма именно в связке: новая
  // причёска приходит ВМЕСТЕ с новым именем, одним событием. Поэтому титул меняется строго на
  // смене ФОРМЫ (ступени внешности), а не на каждом уровне: «Мастер» без единого видимого
  // изменения — пустой звук, а «Просветлённый» вместе с золотой аурой — событие.
  //
  // Формы разведены по архетипам: у робота «Просветлённый» звучит нелепо, у старца «Форсаж» —
  // тоже. Пак может задать свои через growth.forms.
  var FORMS = {
    sage:   ['Мудрец', 'Постигающий', 'Просветлённый', 'Вознесённый', 'Бессмертный'],
    tech:   ['Базовый режим', 'Разгон', 'Форсаж', 'Полная мощность', 'Сверхпроводник'],
    beast:  ['Дикий', 'Прирученный', 'Ухоженный', 'Чемпион', 'Легенда'],
    spirit: ['Тлеющий', 'Горящий', 'Пылающий', 'Ослепительный', 'Сверхновая']
  };
  // Уровень → ступень формы. ПЯТЬ форм, четыре перехода: 3, 5, 7 и 9.
  // ⚠️ Форм именно пять, а не четыре, потому что при четырёх ДЕВЯТЫЙ УРОВЕНЬ НЕ ДАВАЛ НИЧЕГО —
  // повторял восьмой. Поймал живьём на прогоне всех девяти. Это нарушало собственное правило
  // «на каждом уровне что-то происходит», причём ровно на вершине, где обиднее всего:
  // человек добирается до предела и не получает за это ни одного изменения.
  // Чётные уровни отдают предметы, нечётные с третьего — новую форму. Пустых нет.
  function tierOf(level) {
    return level >= 9 ? 4 : level >= 7 ? 3 : level >= 5 ? 2 : level >= 3 ? 1 : 0;
  }

  // Что открывается на каждом уровне, если пак не сказал иначе (pack.json → growth.unlocks).
  // Порядок общий: сперва на шею (не закрывает морду), потом на глаза, потом на голову.
  var DEFAULT_UNLOCKS = [
    { level: 2, item: 'scarf',     anchor: 'neck',     size: 0.30 },
    { level: 3, item: 'glasses',   anchor: 'eyes',     size: 0.38 },
    { level: 5, item: 'party_hat', anchor: 'head_top', size: 0.44 }
  ];
  // Куда садится предмет, если в правиле якорь не указан. По имени файла, а не по догадке.
  function anchorFor(item) {
    if (/hat|cap|crown|halo|ushanka|bandana/.test(item)) return 'head_top';
    if (/glass/.test(item)) return 'eyes';
    return 'neck';
  }

  var growth = {
    xp: 0, level: 1,
    metrics: {},          // сколько опыта пришло по каждому направлению: chat / calc / …
    worn: []              // уже открытые предметы
  };
  try {
    var saved = JSON.parse(global.localStorage.getItem(GROWTH_KEY) || 'null');
    if (saved && typeof saved.xp === 'number') growth = saved;
  } catch (e) {}

  function saveGrowth() {
    try { global.localStorage.setItem(GROWTH_KEY, JSON.stringify(growth)); } catch (e) {}
  }

  // ⚠️ ЗАМЕР ОБЯЗАТЕЛЕН, а не приятное дополнение. Без него геймификация держится на вере:
  // мы не узнаем, растит ли питомец возвраты и обращения, или просто нравится нам самим.
  // Rybbit разведён same-origin на всех сайтах, событие уходит туда же, куда обычная аналитика.
  function trackXP(metric, level, leveled) {
    try {
      var r = global.rybbit;
      if (r && typeof r.event === 'function') {
        r.event('pet_xp', { metric: metric || 'other', level: level, xp: growth.xp });
        if (leveled) r.event('pet_levelup', { level: level });
      }
    } catch (e) {}
  }

  /** Надеть предмет на всех живых питомцев, у которых есть якорь под него. */
  function wear(item, anchorName, size, dx, dy) {
    PETS.forEach(function (p) {
      if (p && typeof p._wear === 'function') p._wear(item, anchorName, size, dx, dy);
    });
  }

  function addXP(amount, metric) {
    var n = Number(amount) || 0;
    if (n <= 0) return growth.level;
    var before = growth.level;
    growth.xp += n;
    growth.metrics[metric || 'other'] = (growth.metrics[metric || 'other'] || 0) + n;
    growth.level = levelOf(growth.xp);
    var leveled = growth.level > before;
    saveGrowth();
    trackXP(metric, growth.level, leveled);
    PETS.forEach(function (p) { if (p && p._look) p._look(growth.level); });
    if (leveled) applyUnlocks(true);
    return growth.level;
  }

  /** Выдать всё, что положено по текущему уровню. announce=true — сказать вслух про новое. */
  function applyUnlocks(announce) {
    var rules = (global.__ODVMASCOT && global.__ODVMASCOT.unlocks) || DEFAULT_UNLOCKS;
    PETS.forEach(function (p) { if (p && p._look) p._look(growth.level); });
    rules.forEach(function (u) {
      if (growth.level < u.level) return;
      var fresh = growth.worn.indexOf(u.item) < 0;
      if (fresh) { growth.worn.push(u.item); saveGrowth(); }
      wear(u.item, u.anchor || anchorFor(u.item), u.size, u.dx, u.dy);
      if (fresh && announce) {
        PETS.forEach(function (p) {
          if (p && p.say) p.say('Уровень ' + growth.level + '! 🎉', 3000);
        });
      }
    });
  }

  if (global.document) {
    global.document.addEventListener('odv:pet-xp', function (e) {
      var d = (e && e.detail) || {};
      addXP(d.amount, d.metric);
    });
  }

  global.__ODVMASCOT = global.__ODVMASCOT || {};
  global.__ODVMASCOT.addXP  = addXP;
  global.__ODVMASCOT.growth = function () {
    return { xp: growth.xp, level: growth.level, metrics: growth.metrics,
             worn: growth.worn.slice(),
             toNext: Math.max(0, needFor(growth.level) - growth.xp) };
  };
  // Сброс — для проверки живьём, чтобы не чистить хранилище руками через консоль.
  global.__ODVMASCOT.reset = function () {
    growth = { xp: 0, level: 1, metrics: {}, worn: [] };
    saveGrowth();
    // ⚠️ Сброс обязан вернуть и ВНЕШНОСТЬ, а не только снять предметы: иначе аура, свечение
    // глаз и левитация остаются от прежнего уровня, и питомец первого уровня выглядит
    // «Бессмертным». Поймал на прогоне всех девяти ступеней.
    PETS.forEach(function (p) { if (p && p._wear) p._wear(null); if (p && p._look) p._look(1); });
    return growth;
  };
  global.__ODVMASCOT.applyUnlocks = function () { applyUnlocks(false); };
  global.__ODVMASCOT.FORMS  = FORMS;
  global.__ODVMASCOT.tierOf = tierOf;
  global.__ODVMASCOT.STEPS  = STEPS;

  global.Biryuzik = {
    /** Живые питомцы на странице — для управления группой (снаружи список только на чтение). */
    pets: function () { return PETS.filter(function (p) { return p.el && p.el.isConnected; }); },
    version: VERSION,
    init: function (opts) { return new Pet(opts); }
  };
})(window);
