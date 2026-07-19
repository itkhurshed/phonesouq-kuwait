/* =========================================================
   PhoneSouq Kuwait — Storefront application
========================================================= */
(function () {
  'use strict';

  /* ---------------------------------------------------------
     Utilities
  --------------------------------------------------------- */
  var $ = function (sel, ctx) { return (ctx || document).querySelector(sel); };
  var $$ = function (sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); };

  function escapeHtml(str) {
    return String(str == null ? '' : str).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function truncate(str, n) {
    str = String(str || '');
    return str.length > n ? str.slice(0, n - 1) + '…' : str;
  }

  // Kuwaiti Dinar formatting: KD 000.000 (3 decimal places / fils)
  function formatMoney(n) {
    var fixed = Number(n || 0).toFixed(3);
    var parts = fixed.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return 'KD ' + parts.join('.');
  }

  function debounce(fn, wait) {
    var t;
    return function () {
      var args = arguments, ctx = this;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(ctx, args); }, wait);
    };
  }

  function renderStars(rating) {
    var full = Math.round(rating);
    var s = '';
    for (var i = 1; i <= 5; i++) s += i <= full ? '★' : '☆';
    return s;
  }

  function uid(prefix) {
    return prefix + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  // deterministic string hash -> stable "random" values per product name
  function hashStr(s) {
    var h = 0;
    s = String(s);
    for (var i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) | 0; }
    return Math.abs(h);
  }
  function seededRange(seed, min, max) {
    return min + (hashStr(seed) % (max - min + 1));
  }

  var COLOR_PALETTE = [
    ['#6c5ce7', '#4834b8'], ['#00b894', '#00806a'], ['#0984e3', '#045a9c'], ['#e17055', '#a84a34'],
    ['#fd79a8', '#c2477a'], ['#2d3436', '#111517'], ['#fdcb6e', '#d19a2a'], ['#d63031', '#8f1f20'],
    ['#00cec9', '#009490'], ['#a29bfe', '#6c5ce7'], ['#e84393', '#b1337a'], ['#636e72', '#40464a']
  ];
  function colorFor(seed) {
    return COLOR_PALETTE[hashStr(seed) % COLOR_PALETTE.length];
  }

  function productImage(brand, model, icon, c1, c2) {
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="640">' +
      '<defs>' +
      '<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="' + c1 + '"/><stop offset="1" stop-color="' + c2 + '"/></linearGradient>' +
      '<filter id="sh" x="-40%" y="-40%" width="180%" height="180%"><feDropShadow dx="0" dy="16" stdDeviation="20" flood-color="#000" flood-opacity="0.30"/></filter>' +
      '</defs>' +
      '<rect width="640" height="640" fill="url(#bg)"/>' +
      '<circle cx="560" cy="70" r="140" fill="rgba(255,255,255,.07)"/>' +
      '<circle cx="60" cy="590" r="110" fill="rgba(255,255,255,.06)"/>' +
      '<g filter="url(#sh)">' +
      '<rect x="165" y="80" width="310" height="368" rx="42" fill="rgba(255,255,255,.15)" stroke="rgba(255,255,255,.55)" stroke-width="3"/>' +
      '</g>' +
      '<text x="50%" y="300" font-size="150" text-anchor="middle" dominant-baseline="middle">' + icon + '</text>' +
      '<text x="50%" y="504" font-size="30" font-family="Arial, sans-serif" font-weight="800" fill="#fff" text-anchor="middle">' + escapeHtml(brand) + '</text>' +
      '<text x="50%" y="540" font-size="20" font-family="Arial, sans-serif" font-weight="500" fill="rgba(255,255,255,.85)" text-anchor="middle">' + escapeHtml(truncate(model, 28)) + '</text>' +
      '</svg>';
    return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
  }

  // TODO: replace with the store's real WhatsApp Business number (digits only, country code, no +/spaces).
  var WHATSAPP_NUMBER = '96550000000';
  function waLink(message) {
    return 'https://wa.me/' + WHATSAPP_NUMBER + '?text=' + encodeURIComponent(message);
  }

  function toast(message, type) {
    var container = $('#toastContainer');
    if (!container) return;
    var icon = { success: '✅', error: '⚠️', info: 'ℹ️' }[type || 'info'];
    var el = document.createElement('div');
    el.className = 'toast ' + (type || 'info');
    el.innerHTML = '<span>' + icon + '</span><span>' + escapeHtml(message) + '</span>';
    container.appendChild(el);
    setTimeout(function () { el.remove(); }, 3000);
  }

  /* ---------------------------------------------------------
     Brand catalog — every brand group requested for the
     Kuwait market. The 19 "priority" brands are featured with
     full product lines; the rest form the browsable directory.
  --------------------------------------------------------- */
  var FEATURED_IDS = ['apple', 'samsung', 'xiaomi', 'redmi', 'poco', 'huawei', 'honor', 'oppo', 'vivo', 'oneplus',
    'realme', 'google-pixel', 'motorola', 'nokia', 'tecno', 'infinix', 'itel', 'nothing', 'asus'];

  var BRAND_GROUPS_RAW = [
    { key: 'major', label: 'Major Global Brands', names: ['Apple', 'Samsung', 'Xiaomi', 'Redmi', 'POCO', 'Huawei', 'Honor', 'Oppo', 'Vivo', 'OnePlus', 'Realme', 'Google Pixel', 'Motorola', 'Nokia', 'Sony Xperia', 'Asus', 'Nothing', 'ZTE', 'Nubia', 'TCL', 'Lenovo'] },
    { key: 'asian', label: 'Chinese & Asian Brands', names: ['Tecno', 'Infinix', 'itel', 'Meizu', 'iQOO', 'Black Shark', 'ROG Phone', 'Coolpad', 'Doogee', 'Ulefone', 'Oukitel', 'Umidigi', 'Cubot', 'Blackview', 'AGM', 'Unihertz', 'Hisense', 'LeEco', 'Gionee', 'Lava', 'Micromax', 'Karbonn', 'Jio', 'Sharp', 'Kyocera', 'Panasonic', 'Fujitsu', 'Balmuda'] },
    { key: 'rugged', label: 'Rugged & Specialist Brands', names: ['CAT', 'Sonim', 'Fairphone', 'HMD', 'Punkt', 'Light Phone', 'Crosscall', 'Doro', 'Energizer', 'Land Rover', 'Vertu', 'Thuraya', 'Iridium'] },
    { key: 'regional', label: 'Regional Brands', names: ['Wiko', 'BQ', 'Archos', 'Alcatel', 'Maxwest', 'Blu', 'NUU Mobile', 'QMobile', 'Symphony', 'Walton', 'Benco', 'Cherry Mobile', 'MyPhone', 'Advan', 'Evercoss', 'Mito', 'Polytron', 'Condor', 'Kazam', 'Prestigio', 'Allview', 'General Mobile', 'Vestel'] },
    { key: 'legacy', label: 'Classic & Discontinued Brands', names: ['BlackBerry', 'HTC', 'LG', 'Microsoft Lumia', 'Siemens', 'BenQ', 'Sony Ericsson', 'Ericsson', 'Palm', 'Essential', 'Nextbit', 'YotaPhone', 'Fire Phone', 'Sagem', 'NEC', 'Pantech', 'Casio', 'Philips', 'Toshiba', 'Dell', 'Acer', 'HP', 'Sendo', 'i-mate', 'Spice', 'XOLO', 'Celkon', 'Yu', 'Smartisan', 'Elephone'] }
  ];

  function slugify(name) { return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''); }

  var BRANDS = [];
  var BRAND_MAP = {};
  BRAND_GROUPS_RAW.forEach(function (g) {
    g.names.forEach(function (name) {
      var id = slugify(name);
      if (BRAND_MAP[id]) return; // guard against accidental dupes
      var colors = colorFor(id);
      var brand = { id: id, name: name, group: g.key, groupLabel: g.label, c1: colors[0], c2: colors[1], featured: FEATURED_IDS.indexOf(id) !== -1 };
      BRANDS.push(brand);
      BRAND_MAP[id] = brand;
    });
  });

  var CATEGORIES = [
    { id: 'smartphones', name: 'Smartphones', icon: '📱' },
    { id: 'tablets', name: 'Tablets', icon: '📟' },
    { id: 'wearables', name: 'Smartwatches', icon: '⌚' },
    { id: 'audio', name: 'Audio', icon: '🎧' },
    { id: 'computer-office', name: 'Computer & Office', icon: '🖥️' },
    { id: 'gaming', name: 'Gaming', icon: '🎮' },
    { id: 'smart-home', name: 'Smart Home', icon: '🏠' },
    { id: 'home-appliances', name: 'Home Appliances', icon: '🍳' },
    { id: 'personal-care', name: 'Personal Care', icon: '🧴' },
    { id: 'cameras', name: 'Cameras', icon: '📷' },
    { id: 'tools-diy', name: 'Tools & DIY', icon: '🛠️' },
    { id: 'outdoor-auto', name: 'Outdoor & Auto', icon: '🚗' },
    { id: 'accessories', name: 'Accessories', icon: '🔌' }
  ];
  var CAT_MAP = {};
  CATEGORIES.forEach(function (c) { CAT_MAP[c.id] = c; });

  var CATEGORY_BLURB = {
    'smartphones': 'a dependable smartphone covering calls, browsing and everyday photography',
    'tablets': 'a spacious tablet for streaming, reading and productivity on the go',
    'wearables': 'a health and fitness companion that pairs with your phone',
    'audio': 'crisp, room-filling sound for music, calls and movies',
    'computer-office': 'a productivity essential built for home and office use',
    'gaming': 'built for responsive, comfortable play sessions',
    'smart-home': 'a smart-home essential that connects to your WiFi for app and voice control',
    'home-appliances': 'a household appliance built for everyday use in Kuwaiti homes',
    'personal-care': 'a personal care essential for your daily routine',
    'tools-diy': 'a reliable tool for home repairs and DIY projects',
    'cameras': 'capture sharp photos and video wherever you go',
    'outdoor-auto': 'stay powered and prepared on the road or outdoors',
    'accessories': 'a genuine PhoneSouq accessory covered by our warranty'
  };
  var EDITION_WARRANTY = { Essential: '6 Months', Plus: '1 Year', Pro: '18 Months', Premium: '2 Years' };

  /* ---------------------------------------------------------
     Product catalog
  --------------------------------------------------------- */
  function accType(name) {
    var n = name.toLowerCase();
    if (n.indexOf('charg') !== -1) return 'charger';
    if (n.indexOf('bud') !== -1 || n.indexOf('ear') !== -1 || n.indexOf('tws') !== -1) return 'earbuds';
    if (n.indexOf('case') !== -1) return 'case';
    if (n.indexOf('power bank') !== -1) return 'powerbank';
    if (n.indexOf('cable') !== -1) return 'cable';
    return 'accessory';
  }
  var ACC_ICON = { charger: '⚡', earbuds: '🎧', case: '🛡️', powerbank: '🔋', cable: '🔗', accessory: '🔌' };

  function phoneDesc(brand, price) {
    var tier = price >= 300 ? 'flagship' : price >= 100 ? 'mid' : 'budget';
    var blurbs = {
      flagship: 'A flagship-class ' + brand + ' smartphone with a premium display, pro-grade cameras and fast charging — backed by PhoneSouq Kuwait\'s official warranty.',
      mid: 'A well-rounded ' + brand + ' smartphone offering a smooth display, strong all-day battery and a capable camera system at a great price.',
      budget: 'An affordable ' + brand + ' smartphone that covers the essentials — calls, browsing, social media and everyday photos — reliably.'
    };
    return blurbs[tier];
  }
  function tabletDesc(brand) {
    return 'A ' + brand + ' tablet built for streaming, note-taking and productivity, with a large crisp display and long battery life.';
  }
  function watchDesc(brand) {
    return 'A ' + brand + ' smartwatch with health tracking, notifications and multi-day battery life, paired seamlessly with your phone.';
  }
  function accDesc(brand, type) {
    var map = {
      charger: 'Genuine ' + brand + ' fast charger — safe, reliable charging with over-current and over-heat protection.',
      earbuds: brand + ' wireless earbuds with clear sound, touch controls and a compact charging case.',
      case: 'Slim protective ' + brand + ' case with reinforced corners — protects without adding bulk.',
      powerbank: brand + ' portable power bank for topping up on the go, with pass-through charging support.',
      cable: brand + ' braided charging cable, rated for thousands of bend cycles.',
      accessory: 'Genuine ' + brand + ' accessory, covered by PhoneSouq Kuwait\'s warranty.'
    };
    return map[type] || map.accessory;
  }

  var SPEC_COLORS = ['Midnight Black', 'Titanium Gray', 'Ocean Blue', 'Starlight White', 'Graphite', 'Forest Green', 'Rose Gold', 'Desert Gold'];

  function phoneSpecs(seed, price) {
    var tier = price >= 300 ? 'flagship' : price >= 100 ? 'mid' : 'budget';
    var displays = { flagship: '6.7" AMOLED 120Hz', mid: '6.5" AMOLED 90Hz', budget: '6.5" HD+ 60Hz' };
    var storage = { flagship: '256GB', mid: '128GB', budget: '64GB' };
    var battery = { flagship: '5000 mAh', mid: '5000 mAh', budget: '4500 mAh' };
    return {
      Display: displays[tier], Battery: battery[tier], Storage: storage[tier],
      Color: SPEC_COLORS[seededRange(seed + '-c', 0, SPEC_COLORS.length - 1)]
    };
  }
  function tabletSpecs(seed) {
    return { Display: '11" LCD', Battery: '8000 mAh', Storage: '128GB', Connectivity: 'WiFi + LTE' };
  }
  function watchSpecs(seed) {
    return { Display: 'AMOLED', 'Battery Life': 'Up to 7 days', WaterResist: '5ATM', Sensors: 'HR, SpO2, GPS' };
  }
  function accSpecs(type) {
    var map = {
      charger: { Type: 'Wall charger', Output: 'Fast charging', Cable: 'Included', Warranty: '1 Year' },
      earbuds: { Battery: 'Up to 30h with case', Bluetooth: '5.2+', WaterResist: 'IPX4', Warranty: '1 Year' },
      case: { Material: 'Silicone / TPU', Protection: 'Drop-tested', Fit: 'Precise cutouts', Warranty: '6 Months' },
      powerbank: { Capacity: '10,000–20,000 mAh', Output: '18–65W', Ports: 'USB-C + USB-A', Warranty: '1 Year' },
      cable: { Length: '1m', Connector: 'USB-C', Durability: '10,000+ bends', Warranty: '6 Months' },
      accessory: { Warranty: '1 Year', Origin: 'Genuine', Support: 'PhoneSouq Care', Compatibility: 'See listing' }
    };
    return map[type] || map.accessory;
  }

  // ---- Featured brands: hand-curated product lines (phones + accessories) ----
  var FEATURED_RAW = [
    // Apple
    { brand: 'apple', name: 'iPhone 17 Pro Max', price: 649, cat: 'smartphones', tags: ['new'] },
    { brand: 'apple', name: 'iPhone 16 Pro Max', price: 599, cat: 'smartphones', tags: [] },
    { brand: 'apple', name: 'iPhone 16', price: 349, cat: 'smartphones', tags: [] },
    { brand: 'apple', name: 'iPhone 15', price: 279, oldPrice: 309, cat: 'smartphones', tags: ['sale'] },
    { brand: 'apple', name: 'MagSafe Charger', price: 12.5, cat: 'accessories', tags: [] },
    { brand: 'apple', name: 'AirPods Pro 2', price: 69, cat: 'accessories', tags: [] },
    // Samsung
    { brand: 'samsung', name: 'Galaxy S26 Ultra', price: 459, cat: 'smartphones', tags: ['new'] },
    { brand: 'samsung', name: 'Galaxy S24 Ultra', price: 429, cat: 'smartphones', tags: [] },
    { brand: 'samsung', name: 'Galaxy Z Fold6', price: 599, cat: 'smartphones', tags: [] },
    { brand: 'samsung', name: 'Galaxy A55 5G', price: 139, oldPrice: 159, cat: 'smartphones', tags: ['sale'] },
    { brand: 'samsung', name: '45W Super Fast Charger', price: 15, cat: 'accessories', tags: [] },
    { brand: 'samsung', name: 'Galaxy Buds3 Pro', price: 55, cat: 'accessories', tags: [] },
    // Xiaomi
    { brand: 'xiaomi', name: 'Xiaomi 14 Ultra', price: 399, cat: 'smartphones', tags: [] },
    { brand: 'xiaomi', name: 'Xiaomi 14', price: 259, cat: 'smartphones', tags: ['new'] },
    { brand: 'xiaomi', name: 'Xiaomi 13T', price: 199, oldPrice: 229, cat: 'smartphones', tags: ['sale'] },
    { brand: 'xiaomi', name: '120W HyperCharge Combo', price: 18, cat: 'accessories', tags: [] },
    { brand: 'xiaomi', name: 'Power Bank 3 20000mAh', price: 13, cat: 'accessories', tags: [] },
    // Redmi
    { brand: 'redmi', name: 'Redmi Note 13 Pro+', price: 99, cat: 'smartphones', tags: ['new'] },
    { brand: 'redmi', name: 'Redmi Note 13', price: 69, cat: 'smartphones', tags: [] },
    { brand: 'redmi', name: 'Redmi 13C', price: 49, cat: 'smartphones', tags: [] },
    { brand: 'redmi', name: '33W Fast Charger', price: 7, cat: 'accessories', tags: [] },
    { brand: 'redmi', name: 'Redmi Buds 5', price: 12, cat: 'accessories', tags: [] },
    // POCO
    { brand: 'poco', name: 'POCO X6 Pro', price: 89, cat: 'smartphones', tags: [] },
    { brand: 'poco', name: 'POCO F6', price: 109, cat: 'smartphones', tags: ['new'] },
    { brand: 'poco', name: 'POCO M6 Pro', price: 59, oldPrice: 69, cat: 'smartphones', tags: ['sale'] },
    { brand: 'poco', name: '67W Charger', price: 8.5, cat: 'accessories', tags: [] },
    { brand: 'poco', name: 'Case for X6 Pro', price: 4, cat: 'accessories', tags: [] },
    // Huawei
    { brand: 'huawei', name: 'Mate 60 Pro', price: 349, cat: 'smartphones', tags: [] },
    { brand: 'huawei', name: 'Nova 12', price: 129, cat: 'smartphones', tags: ['new'] },
    { brand: 'huawei', name: 'P60 Pro', price: 299, oldPrice: 339, cat: 'smartphones', tags: ['sale'] },
    { brand: 'huawei', name: 'SuperCharge 66W', price: 14, cat: 'accessories', tags: [] },
    { brand: 'huawei', name: 'FreeBuds Pro 3', price: 42, cat: 'accessories', tags: [] },
    // Honor
    { brand: 'honor', name: 'Magic6 Pro', price: 329, cat: 'smartphones', tags: [] },
    { brand: 'honor', name: 'Honor 200', price: 149, cat: 'smartphones', tags: ['new'] },
    { brand: 'honor', name: 'Honor X9b', price: 99, cat: 'smartphones', tags: [] },
    { brand: 'honor', name: '66W SuperCharge Adapter', price: 9, cat: 'accessories', tags: [] },
    { brand: 'honor', name: 'Case for Magic6', price: 4.5, cat: 'accessories', tags: [] },
    // Oppo
    { brand: 'oppo', name: 'Find X7 Ultra', price: 349, cat: 'smartphones', tags: [] },
    { brand: 'oppo', name: 'Reno 12', price: 149, cat: 'smartphones', tags: ['new'] },
    { brand: 'oppo', name: 'Oppo A79', price: 69, oldPrice: 79, cat: 'smartphones', tags: ['sale'] },
    { brand: 'oppo', name: '80W SuperVOOC Charger', price: 11, cat: 'accessories', tags: [] },
    { brand: 'oppo', name: 'Enco Air3 Pro', price: 19, cat: 'accessories', tags: [] },
    // Vivo
    { brand: 'vivo', name: 'X100 Pro', price: 369, cat: 'smartphones', tags: [] },
    { brand: 'vivo', name: 'V30', price: 159, cat: 'smartphones', tags: ['new'] },
    { brand: 'vivo', name: 'Y36', price: 69, cat: 'smartphones', tags: [] },
    { brand: 'vivo', name: 'FlashCharge 80W', price: 10, cat: 'accessories', tags: [] },
    { brand: 'vivo', name: 'TWS 3 Earbuds', price: 15, cat: 'accessories', tags: [] },
    // OnePlus
    { brand: 'oneplus', name: 'OnePlus 12', price: 329, cat: 'smartphones', tags: [] },
    { brand: 'oneplus', name: 'OnePlus 12R', price: 229, cat: 'smartphones', tags: ['new'] },
    { brand: 'oneplus', name: 'Nord 4', price: 159, cat: 'smartphones', tags: [] },
    { brand: 'oneplus', name: 'SUPERVOOC 100W Charger', price: 16, cat: 'accessories', tags: [] },
    { brand: 'oneplus', name: 'Buds 3', price: 29, cat: 'accessories', tags: [] },
    // Realme
    { brand: 'realme', name: 'GT6', price: 199, cat: 'smartphones', tags: ['new'] },
    { brand: 'realme', name: '12 Pro+', price: 129, cat: 'smartphones', tags: [] },
    { brand: 'realme', name: 'C67', price: 49, oldPrice: 59, cat: 'smartphones', tags: ['sale'] },
    { brand: 'realme', name: '67W Dart Charge', price: 7.5, cat: 'accessories', tags: [] },
    { brand: 'realme', name: 'Buds Air 6', price: 14, cat: 'accessories', tags: [] },
    // Google Pixel
    { brand: 'google-pixel', name: 'Pixel 10 Pro XL', price: 429, cat: 'smartphones', tags: ['new'] },
    { brand: 'google-pixel', name: 'Pixel 9 Pro', price: 399, cat: 'smartphones', tags: [] },
    { brand: 'google-pixel', name: 'Pixel 9', price: 299, cat: 'smartphones', tags: [] },
    { brand: 'google-pixel', name: 'Pixel 8a', price: 219, oldPrice: 249, cat: 'smartphones', tags: ['sale'] },
    { brand: 'google-pixel', name: '30W USB-C Charger', price: 9, cat: 'accessories', tags: [] },
    { brand: 'google-pixel', name: 'Pixel Buds Pro 2', price: 59, cat: 'accessories', tags: [] },
    // Motorola
    { brand: 'motorola', name: 'Razr 50 Ultra', price: 349, cat: 'smartphones', tags: ['new'] },
    { brand: 'motorola', name: 'Edge 50 Pro', price: 199, cat: 'smartphones', tags: [] },
    { brand: 'motorola', name: 'Moto G84', price: 89, cat: 'smartphones', tags: [] },
    { brand: 'motorola', name: 'TurboPower 68W Charger', price: 9.5, cat: 'accessories', tags: [] },
    { brand: 'motorola', name: 'Moto Buds+', price: 22, cat: 'accessories', tags: [] },
    // Nokia
    { brand: 'nokia', name: 'XR21', price: 149, cat: 'smartphones', tags: [] },
    { brand: 'nokia', name: 'G42 5G', price: 69, cat: 'smartphones', tags: [] },
    { brand: 'nokia', name: '110 4G', price: 12, cat: 'smartphones', tags: [] },
    { brand: 'nokia', name: '33W Charger', price: 6, cat: 'accessories', tags: [] },
    { brand: 'nokia', name: 'Case for XR21', price: 5, cat: 'accessories', tags: [] },
    // Tecno
    { brand: 'tecno', name: 'Phantom V Fold', price: 399, cat: 'smartphones', tags: ['new'] },
    { brand: 'tecno', name: 'Camon 30 Pro', price: 99, cat: 'smartphones', tags: [] },
    { brand: 'tecno', name: 'Spark 20', price: 49, cat: 'smartphones', tags: [] },
    { brand: 'tecno', name: '45W Charger', price: 6.5, cat: 'accessories', tags: [] },
    { brand: 'tecno', name: 'Buds T1', price: 9, cat: 'accessories', tags: [] },
    // Infinix
    { brand: 'infinix', name: 'Zero 30', price: 109, cat: 'smartphones', tags: ['new'] },
    { brand: 'infinix', name: 'Note 40 Pro', price: 79, cat: 'smartphones', tags: [] },
    { brand: 'infinix', name: 'Smart 8', price: 29, oldPrice: 35, cat: 'smartphones', tags: ['sale'] },
    { brand: 'infinix', name: '45W Charger', price: 6, cat: 'accessories', tags: [] },
    { brand: 'infinix', name: 'Buds Beat', price: 8, cat: 'accessories', tags: [] },
    // itel
    { brand: 'itel', name: 'S24', price: 35, cat: 'smartphones', tags: [] },
    { brand: 'itel', name: 'A70', price: 25, oldPrice: 29, cat: 'smartphones', tags: ['sale'] },
    { brand: 'itel', name: '18W Charger', price: 3.5, cat: 'accessories', tags: [] },
    // Nothing
    { brand: 'nothing', name: 'Phone (2)', price: 229, cat: 'smartphones', tags: [] },
    { brand: 'nothing', name: 'Phone (2a)', price: 129, cat: 'smartphones', tags: ['new'] },
    { brand: 'nothing', name: 'Ear (a)', price: 29, cat: 'accessories', tags: [] },
    // Asus
    { brand: 'asus', name: 'Zenfone 11 Ultra', price: 299, cat: 'smartphones', tags: ['new'] },
    { brand: 'asus', name: 'Zenfone 10', price: 219, cat: 'smartphones', tags: [] },
    { brand: 'asus', name: '65W Charger', price: 9, cat: 'accessories', tags: [] },
    { brand: 'asus', name: 'Case for Zenfone 11', price: 5, cat: 'accessories', tags: [] }
  ];

  // ---- Secondary brands: one representative model each ----
  var SECONDARY_RAW = [
    // Chinese & Asian (remaining)
    ['meizu', 'Meizu 21', 249], ['iqoo', 'iQOO 12', 329], ['black-shark', 'Black Shark 5 Pro', 199],
    ['rog-phone', 'ROG Phone 8 Pro', 449], ['coolpad', 'Cool 20', 89], ['doogee', 'V30', 129],
    ['ulefone', 'Armor 24', 159], ['oukitel', 'WP21', 149], ['umidigi', 'G3', 45], ['cubot', 'KingKong 9', 79],
    ['blackview', 'BV9300', 169], ['agm', 'Glory G1', 189], ['unihertz', 'Jelly Max', 99], ['hisense', 'Infinity H30', 89],
    ['leeco', 'Le Pro3', 39], ['gionee', 'Max', 55], ['lava', 'Blaze 3', 35], ['micromax', 'IN Note 2', 45],
    ['karbonn', 'Aura', 25], ['jio', 'JioPhone Next', 22], ['sharp', 'Aquos R9', 289], ['kyocera', 'DuraForce Ultra', 149],
    ['panasonic', 'Eluga', 65], ['fujitsu', 'Arrows', 199], ['balmuda', 'Phone', 249],
    // Rugged & specialist
    ['cat', 'S75', 199], ['sonim', 'XP10', 249], ['fairphone', 'Fairphone 5', 289], ['hmd', 'Skyline', 179],
    ['punkt', 'MP02', 149], ['light-phone', 'Light Phone II', 199], ['crosscall', 'CORE-X5', 179], ['doro', '8100', 89],
    ['energizer', 'Hard Case P28K', 129], ['land-rover', 'Explore', 219], ['vertu', 'Metavertu', 649],
    ['thuraya', 'X5-Touch', 349], ['iridium', 'Extreme', 399],
    // Regional
    ['wiko', 'T60', 45], ['bq', 'Aquaris', 55], ['archos', '60 Neon', 29], ['alcatel', '1L', 25],
    ['maxwest', 'Astro', 35], ['blu', 'G91 Pro', 49], ['nuu-mobile', 'A15', 39], ['qmobile', 'Noir Z14', 29],
    ['symphony', 'i98', 22], ['walton', 'Primo N7', 32], ['benco', 'V1', 28], ['cherry-mobile', 'Flare S9', 35],
    ['myphone', 'myX10', 27], ['advan', 'G5', 24], ['evercoss', 'U50', 22], ['mito', 'A310', 26],
    ['polytron', 'Zap 6', 23], ['condor', 'Griffe G6', 30], ['kazam', 'Trooper 2', 33], ['prestigio', 'Muze', 31],
    ['allview', 'Soul X6', 38], ['general-mobile', 'GM 23', 79], ['vestel', 'Venus V7', 55],
    // Classic & discontinued
    ['blackberry', 'KEY2', 149], ['htc', 'U23', 129], ['lg', 'Wing', 179], ['microsoft-lumia', 'Lumia 950', 59],
    ['siemens', 'SXG75', 45], ['benq', 'BenQ-Siemens EF81', 35], ['sony-ericsson', 'Xperia X10', 55],
    ['ericsson', 'T28', 25], ['palm', 'Treo Pro', 65], ['essential', 'PH-1', 99], ['nextbit', 'Robin', 69],
    ['yotaphone', 'YotaPhone 3', 129], ['fire-phone', 'Fire Phone', 45], ['sagem', 'myX-5', 19], ['nec', 'N-01', 39],
    ['pantech', 'Vega', 42], ['casio', "G'zOne", 59], ['philips', 'Xenium', 29], ['toshiba', 'TG01', 49],
    ['dell', 'Venue Pro', 55], ['acer', 'Liquid', 45], ['hp', 'Elite x3', 89], ['sendo', 'Sendo X', 22],
    ['i-mate', 'JAMin', 35], ['spice', 'Stellar', 24], ['xolo', 'Black', 33], ['celkon', 'Diamond', 21],
    ['yu', 'Yureka', 28], ['smartisan', 'Nut Pro', 55], ['elephone', 'P8', 27]
  ];

  var TABLET_RAW = [
    { brand: 'apple', name: 'iPad Air 11″', price: 259, tags: ['new'] },
    { brand: 'apple', name: 'iPad 10th Gen', price: 149, tags: [] },
    { brand: 'samsung', name: 'Galaxy Tab S9', price: 279, tags: ['new'] },
    { brand: 'samsung', name: 'Galaxy Tab A9', price: 79, tags: [] },
    { brand: 'xiaomi', name: 'Xiaomi Pad 6', price: 129, tags: [] },
    { brand: 'huawei', name: 'MatePad 11.5', price: 149, tags: [] }
  ];

  var WATCH_RAW = [
    { brand: 'apple', name: 'Apple Watch Series 10', price: 149, tags: ['new'] },
    { brand: 'samsung', name: 'Galaxy Watch7', price: 99, tags: [] },
    { brand: 'huawei', name: 'Watch GT5', price: 79, tags: [] },
    { brand: 'xiaomi', name: 'Watch S3', price: 45, tags: [] },
    { brand: 'honor', name: 'Watch 5', price: 39, oldPrice: 49, tags: ['sale'] },
    { brand: 'oppo', name: 'Watch X', price: 89, tags: [] }
  ];

  function buildProducts() {
    var list = [];
    var idx = 0;

    function push(entry) { entry.idx = ++idx; entry.id = 'p' + idx; list.push(entry); }

    FEATURED_RAW.forEach(function (p) {
      var brand = BRAND_MAP[p.brand];
      var cat = CAT_MAP[p.cat];
      var seed = p.brand + '-' + p.name;
      var isAcc = p.cat === 'accessories';
      var type = isAcc ? accType(p.name) : null;
      var icon = isAcc ? ACC_ICON[type] : cat.icon;
      var img1 = productImage(brand.name, p.name, icon, brand.c1, brand.c2);
      var img2 = productImage(brand.name, p.name + ' — detail', icon, brand.c2, brand.c1);
      push({
        name: brand.name + ' ' + p.name,
        brand: brand.name, brandId: brand.id, category: p.cat, categoryName: cat.name,
        price: p.price, oldPrice: p.oldPrice || null,
        discountPct: p.oldPrice ? Math.round((p.oldPrice - p.price) / p.oldPrice * 100) : 0,
        rating: (38 + seededRange(seed + 'r', 0, 11)) / 10,
        reviews: seededRange(seed + 'v', 40, 2600),
        stock: seededRange(seed + 's', 3, 90),
        tags: p.tags || [],
        description: isAcc ? accDesc(brand.name, type) : phoneDesc(brand.name, p.price),
        specs: isAcc ? accSpecs(type) : phoneSpecs(seed, p.price),
        images: [img1, img2], custom: false
      });
    });

    SECONDARY_RAW.forEach(function (row) {
      var brand = BRAND_MAP[row[0]];
      var model = row[1], price = row[2];
      var cat = CAT_MAP.smartphones;
      var seed = row[0] + '-' + model;
      var tagRoll = hashStr(seed + 'tag');
      var tags = []; var oldPrice = null;
      if (tagRoll % 9 === 0) { tags = ['sale']; oldPrice = Math.round(price * (1 + (10 + (tagRoll % 15)) / 100) * 1000) / 1000; }
      else if (tagRoll % 7 === 0) { tags = ['new']; }
      var img1 = productImage(brand.name, model, cat.icon, brand.c1, brand.c2);
      var img2 = productImage(brand.name, model + ' — detail', cat.icon, brand.c2, brand.c1);
      push({
        name: brand.name + ' ' + model,
        brand: brand.name, brandId: brand.id, category: 'smartphones', categoryName: cat.name,
        price: price, oldPrice: oldPrice, discountPct: oldPrice ? Math.round((oldPrice - price) / oldPrice * 100) : 0,
        rating: (36 + seededRange(seed + 'r', 0, 12)) / 10,
        reviews: seededRange(seed + 'v', 8, 900),
        stock: seededRange(seed + 's', 2, 60),
        tags: tags,
        description: phoneDesc(brand.name, price),
        specs: phoneSpecs(seed, price),
        images: [img1, img2], custom: false
      });
    });

    TABLET_RAW.forEach(function (p) {
      var brand = BRAND_MAP[p.brand];
      var cat = CAT_MAP.tablets;
      var seed = p.brand + '-tab-' + p.name;
      var img1 = productImage(brand.name, p.name, cat.icon, brand.c1, brand.c2);
      var img2 = productImage(brand.name, p.name + ' — detail', cat.icon, brand.c2, brand.c1);
      push({
        name: brand.name + ' ' + p.name,
        brand: brand.name, brandId: brand.id, category: 'tablets', categoryName: cat.name,
        price: p.price, oldPrice: p.oldPrice || null,
        discountPct: p.oldPrice ? Math.round((p.oldPrice - p.price) / p.oldPrice * 100) : 0,
        rating: (40 + seededRange(seed + 'r', 0, 9)) / 10,
        reviews: seededRange(seed + 'v', 30, 900),
        stock: seededRange(seed + 's', 4, 60),
        tags: p.tags || [],
        description: tabletDesc(brand.name),
        specs: tabletSpecs(seed),
        images: [img1, img2], custom: false
      });
    });

    WATCH_RAW.forEach(function (p) {
      var brand = BRAND_MAP[p.brand];
      var cat = CAT_MAP.wearables;
      var seed = p.brand + '-watch-' + p.name;
      var img1 = productImage(brand.name, p.name, cat.icon, brand.c1, brand.c2);
      var img2 = productImage(brand.name, p.name + ' — detail', cat.icon, brand.c2, brand.c1);
      push({
        name: brand.name + ' ' + p.name,
        brand: brand.name, brandId: brand.id, category: 'wearables', categoryName: cat.name,
        price: p.price, oldPrice: p.oldPrice || null,
        discountPct: p.oldPrice ? Math.round((p.oldPrice - p.price) / p.oldPrice * 100) : 0,
        rating: (40 + seededRange(seed + 'r', 0, 9)) / 10,
        reviews: seededRange(seed + 'v', 20, 700),
        stock: seededRange(seed + 's', 4, 50),
        tags: p.tags || [],
        description: watchDesc(brand.name),
        specs: watchSpecs(seed),
        images: [img1, img2], custom: false
      });
    });

    return list;
  }

  // ---- Real photographed catalog (700 items from the two supplied KWD price lists) ----
  function buildRealProducts() {
    var raw = window.REAL_CATALOG || [];
    return raw.map(function (r, i) {
      var cat = CAT_MAP[r.category] || CAT_MAP.accessories;
      var seed = r.seed;
      var brand = r.edition ? ('PhoneSouq ' + r.edition) : 'PhoneSouq';
      var tagRoll = hashStr(seed + 'tag');
      var tags = []; var oldPrice = null;
      if (tagRoll % 8 === 0) { tags = ['sale']; oldPrice = Math.round(r.price * (1 + (10 + (tagRoll % 20)) / 100) * 1000) / 1000; }
      else if (tagRoll % 6 === 0) { tags = ['new']; }
      var warranty = r.edition ? EDITION_WARRANTY[r.edition] : '1 Year';
      return {
        id: 'r' + (i + 1), idx: 100000 + i,
        name: r.name, brand: brand, brandId: 'phonesouq',
        category: r.category, categoryName: cat.name,
        price: r.price, oldPrice: oldPrice,
        discountPct: oldPrice ? Math.round((oldPrice - r.price) / oldPrice * 100) : 0,
        rating: (36 + seededRange(seed + 'r', 0, 13)) / 10,
        reviews: seededRange(seed + 'v', 5, 650),
        stock: seededRange(seed + 's', 2, 70),
        tags: tags,
        description: r.name + ' — ' + (CATEGORY_BLURB[r.category] || CATEGORY_BLURB.accessories) + '.',
        specs: { Warranty: warranty, Origin: 'Imported', Support: 'PhoneSouq Care', Category: cat.name },
        images: [r.image], custom: false, realPhoto: true
      };
    });
  }

  var BASE_PRODUCTS = buildProducts().concat(buildRealProducts());
  // Deterministically mark a small, realistic slice of the catalog as
  // out-of-stock (never the brand-new flagship arrivals) so the storefront
  // can demo real in-stock / out-of-stock states.
  BASE_PRODUCTS.forEach(function (p) {
    if (p.tags.indexOf('new') !== -1) return;
    if (hashStr(p.id + 'oos') % 23 === 0) p.stock = 0;
  });

  /* ---------------------------------------------------------
     Storage-backed state
  --------------------------------------------------------- */
  var LS = { cart: 'en_cart', wishlist: 'en_wishlist', customProducts: 'en_custom_products', theme: 'en_theme' };

  function loadJSON(key, fallback) {
    try { var v = JSON.parse(localStorage.getItem(key)); return v == null ? fallback : v; } catch (e) { return fallback; }
  }
  function saveJSON(key, val) { localStorage.setItem(key, JSON.stringify(val)); }

  var PAGE_SIZE = 24;

  var state = {
    products: [],
    cart: loadJSON(LS.cart, []),
    wishlist: loadJSON(LS.wishlist, []),
    filters: { category: 'all', brands: [], maxPrice: 700, minRating: 0, sort: 'featured', search: '', dealsOnly: false },
    visibleCount: PAGE_SIZE
  };

  function refreshProducts() {
    var custom = loadJSON(LS.customProducts, []);
    state.products = BASE_PRODUCTS.concat(custom);
  }
  refreshProducts();

  function getProduct(id) { return state.products.find(function (p) { return p.id === id; }); }

  /* ---------------------------------------------------------
     Cart
  --------------------------------------------------------- */
  function saveCart() { saveJSON(LS.cart, state.cart); }

  function addToCart(id, qty) {
    qty = qty || 1;
    var line = state.cart.find(function (c) { return c.id === id; });
    if (line) line.qty += qty; else state.cart.push({ id: id, qty: qty });
    saveCart();
    updateCartBadge(true);
    renderCart();
    var p = getProduct(id);
    if (p && window.Tracking) Tracking.trackEvent('add_to_cart', { id: p.id, name: p.name, price: p.price, qty: qty });
  }

  function removeFromCart(id) {
    state.cart = state.cart.filter(function (c) { return c.id !== id; });
    saveCart();
    updateCartBadge();
    renderCart();
    if (window.Tracking) Tracking.trackEvent('remove_from_cart', { id: id });
  }

  function setQty(id, qty) {
    var line = state.cart.find(function (c) { return c.id === id; });
    if (!line) return;
    line.qty = Math.max(1, qty);
    saveCart();
    renderCart();
    updateCartBadge();
  }

  function cartLines() {
    return state.cart.map(function (c) {
      var p = getProduct(c.id);
      return p ? { product: p, qty: c.qty } : null;
    }).filter(Boolean);
  }

  var FREE_DELIVERY_THRESHOLD = 25;
  var DELIVERY_FEE = 2;

  function cartTotals() {
    var subtotal = cartLines().reduce(function (s, l) { return s + l.product.price * l.qty; }, 0);
    var shipping = subtotal === 0 || subtotal >= FREE_DELIVERY_THRESHOLD ? 0 : DELIVERY_FEE;
    return { subtotal: subtotal, shipping: shipping, total: subtotal + shipping };
  }

  function updateCartBadge(bump) {
    var count = state.cart.reduce(function (s, c) { return s + c.qty; }, 0);
    var badge = $('#cartCount');
    if (badge) {
      badge.textContent = count;
      if (bump) { badge.classList.remove('bump'); void badge.offsetWidth; badge.classList.add('bump'); }
    }
  }

  function renderCart() {
    var wrap = $('#cartItems');
    var lines = cartLines();
    var empty = $('#cartEmpty');
    var footer = $('#cartFooter');
    if (!wrap) return;

    if (lines.length === 0) {
      wrap.innerHTML = '';
      empty.classList.add('show');
      footer.classList.remove('show');
      return;
    }
    empty.classList.remove('show');
    footer.classList.add('show');

    wrap.innerHTML = lines.map(function (l) {
      var p = l.product;
      return '<div class="cart-item" data-id="' + p.id + '">' +
        '<img src="' + p.images[0] + '" alt="' + escapeHtml(p.name) + '">' +
        '<div class="ci-info">' +
        '<div class="ci-brand">' + escapeHtml(p.brand) + '</div>' +
        '<div class="ci-name">' + escapeHtml(p.name) + '</div>' +
        '<div class="ci-qty-row">' +
        '<button class="qty-btn" data-action="dec">−</button>' +
        '<span>' + l.qty + '</span>' +
        '<button class="qty-btn" data-action="inc">+</button>' +
        '</div>' +
        '<button class="ci-remove" data-action="remove">Remove</button>' +
        '</div>' +
        '<div class="ci-price">' + formatMoney(p.price * l.qty) + '</div>' +
        '</div>';
    }).join('');

    var totals = cartTotals();
    $('#cartSubtotal').textContent = formatMoney(totals.subtotal);
    $('#cartShipping').textContent = totals.shipping === 0 ? 'FREE' : formatMoney(totals.shipping);
    $('#cartTotal').textContent = formatMoney(totals.total);
  }

  function openCart() {
    $('#cartDrawer').classList.add('open');
    $('#cartOverlay').classList.add('open');
    document.body.style.overflow = 'hidden';
  }
  function closeCart() {
    $('#cartDrawer').classList.remove('open');
    $('#cartOverlay').classList.remove('open');
    document.body.style.overflow = '';
  }

  /* ---------------------------------------------------------
     Wishlist
  --------------------------------------------------------- */
  function isWished(id) { return state.wishlist.indexOf(id) !== -1; }
  function toggleWishlist(id) {
    if (isWished(id)) {
      state.wishlist = state.wishlist.filter(function (w) { return w !== id; });
    } else {
      state.wishlist.push(id);
      if (window.Tracking) Tracking.trackEvent('add_to_wishlist', { id: id });
    }
    saveJSON(LS.wishlist, state.wishlist);
    updateWishlistBadge();
  }
  function updateWishlistBadge() {
    var el = $('#wishlistCount');
    if (el) el.textContent = state.wishlist.length;
  }

  /* ---------------------------------------------------------
     Filtering / sorting / rendering products
  --------------------------------------------------------- */
  function filteredProducts() {
    var f = state.filters;
    var list = state.products.filter(function (p) {
      if (f.category !== 'all' && p.category !== f.category) return false;
      if (f.brands.length && f.brands.indexOf(p.brandId) === -1) return false;
      if (p.price > f.maxPrice) return false;
      if (f.minRating && p.rating < f.minRating) return false;
      if (f.dealsOnly && p.tags.indexOf('sale') === -1) return false;
      if (f.search) {
        var q = f.search.toLowerCase();
        var hay = (p.name + ' ' + p.brand + ' ' + p.categoryName + ' ' + p.description).toLowerCase();
        if (hay.indexOf(q) === -1) return false;
      }
      return true;
    });

    switch (f.sort) {
      case 'price-asc': list.sort(function (a, b) { return a.price - b.price; }); break;
      case 'price-desc': list.sort(function (a, b) { return b.price - a.price; }); break;
      case 'rating': list.sort(function (a, b) { return b.rating - a.rating; }); break;
      case 'newest': list.sort(function (a, b) { return (b.custom ? 1e9 + b.createdAt : b.idx) - (a.custom ? 1e9 + a.createdAt : a.idx); }); break;
      default: break;
    }
    return list;
  }

  function productCardHTML(p) {
    var badges = '';
    if (p.tags.indexOf('sale') !== -1) badges += '<span class="pc-badge sale">-' + p.discountPct + '%</span>';
    if (p.tags.indexOf('new') !== -1) badges += '<span class="pc-badge new">New</span>';
    var wished = isWished(p.id);
    var oos = p.stock === 0;
    var stockClass = oos ? 'out' : (p.stock <= 5 ? 'low' : 'in');
    var stockLabel = oos ? 'Out of Stock' : (p.stock <= 5 ? 'Only ' + p.stock + ' left' : 'In Stock');
    return '' +
      '<div class="product-card' + (oos ? ' is-oos' : '') + '" data-id="' + p.id + '">' +
      '<div class="pc-media" data-action="open">' +
      '<img src="' + p.images[0] + '" alt="' + escapeHtml(p.name) + '" loading="lazy">' +
      '<div class="pc-badges">' + badges + '</div>' +
      '<button class="pc-wish ' + (wished ? 'active' : '') + '" data-action="wish" aria-label="Toggle wishlist">' + (wished ? '♥' : '♡') + '</button>' +
      (oos ? '<div class="pc-oos-overlay">Out of Stock</div>' : '<button class="pc-quickadd" data-action="quickadd">+ Add to Cart</button>') +
      '</div>' +
      '<div class="pc-body">' +
      '<span class="pc-brand">' + escapeHtml(p.brand) + '</span>' +
      '<span class="pc-name" data-action="open">' + escapeHtml(p.name) + '</span>' +
      '<span class="pc-rating">' + renderStars(p.rating) + ' <span>(' + p.reviews + ')</span></span>' +
      '<span class="pc-stock ' + stockClass + '"><span class="dot"></span>' + stockLabel + '</span>' +
      '<div class="pc-price-row">' +
      '<span class="pc-price">' + formatMoney(p.price) + '</span>' +
      (p.oldPrice ? '<span class="pc-old-price">' + formatMoney(p.oldPrice) + '</span>' : '') +
      '</div>' +
      '</div>' +
      '</div>';
  }

  function skeletonGridHTML(n) {
    var one = '<div class="skeleton-card"><div class="skeleton-media"></div><div class="skeleton-line"></div><div class="skeleton-line short"></div></div>';
    return new Array(n).fill(one).join('');
  }

  var firstRender = true;
  function renderGrid() {
    var grid = $('#productGrid');
    var noResults = $('#noResults');
    if (!grid) return;

    function paint() {
      var list = filteredProducts();
      var shown = list.slice(0, state.visibleCount);
      $('#resultsCount').textContent = list.length + ' product' + (list.length === 1 ? '' : 's') + ' found';
      if (list.length === 0) {
        grid.innerHTML = '';
        noResults.hidden = false;
      } else {
        noResults.hidden = true;
        grid.innerHTML = shown.map(productCardHTML).join('');
        $$('.product-card', grid).forEach(function (el, i) {
          el.style.animationDelay = (Math.min(i, 12) * 0.04) + 's';
        });
      }
      var loadMoreWrap = $('#loadMoreWrap');
      if (list.length > shown.length) {
        loadMoreWrap.hidden = false;
        $('#loadMoreCount').textContent = 'Showing ' + shown.length + ' of ' + list.length + ' products';
      } else {
        loadMoreWrap.hidden = true;
      }
    }

    if (firstRender) {
      grid.innerHTML = skeletonGridHTML(8);
      setTimeout(function () { paint(); firstRender = false; }, 420);
    } else {
      paint();
    }
  }

  function resetPaging() { state.visibleCount = PAGE_SIZE; }

  function renderCategoryTabs() {
    var el = $('#catTabs');
    var all = ['<button class="cat-tab' + (state.filters.category === 'all' ? ' active' : '') + '" data-cat="all">All</button>'];
    CATEGORIES.forEach(function (c) {
      all.push('<button class="cat-tab' + (state.filters.category === c.id ? ' active' : '') + '" data-cat="' + c.id + '">' + c.icon + ' ' + c.name + '</button>');
    });
    el.innerHTML = all.join('');
  }

  function renderBrandFilterList() {
    var el = $('#brandFilterList');
    var featured = BRANDS.filter(function (b) { return b.featured; });
    el.innerHTML = featured.map(function (b) {
      var checked = state.filters.brands.indexOf(b.id) !== -1;
      return '<label><input type="checkbox" value="' + b.id + '" ' + (checked ? 'checked' : '') + '> ' + b.name + '</label>';
    }).join('');
  }

  function renderRatingFilterList() {
    var el = $('#ratingFilterList');
    var opts = [4.5, 4, 3];
    el.innerHTML = opts.map(function (r) {
      var checked = state.filters.minRating === r;
      return '<label><input type="radio" name="ratingFilter" value="' + r + '" ' + (checked ? 'checked' : '') + '> ' + renderStars(r) + ' &amp; up</label>';
    }).join('') + '<label><input type="radio" name="ratingFilter" value="0" ' + (state.filters.minRating === 0 ? 'checked' : '') + '> Any rating</label>';
  }

  function renderBrandsSection() {
    var el = $('#brandGrid');
    var featured = BRANDS.filter(function (b) { return b.featured; });
    el.innerHTML = featured.map(function (b) {
      var count = state.products.filter(function (p) { return p.brandId === b.id; }).length;
      return '<div class="brand-card" data-brand="' + b.id + '">' +
        '<div class="brand-logo" style="background:linear-gradient(135deg,' + b.c1 + ',' + b.c2 + ')">' + b.name.charAt(0) + '</div>' +
        '<div class="brand-name">' + escapeHtml(b.name) + '</div>' +
        '<div class="brand-count">' + count + ' products</div>' +
        '</div>';
    }).join('');

    var dir = $('#brandDirectory');
    dir.innerHTML = BRAND_GROUPS_RAW.map(function (g) {
      var brands = BRANDS.filter(function (b) { return b.group === g.key; });
      var chips = brands.map(function (b) {
        var count = state.products.filter(function (p) { return p.brandId === b.id; }).length;
        return '<button class="bd-chip" data-brand="' + b.id + '">' + escapeHtml(b.name) + (count ? ' <span class="bd-count">(' + count + ')</span>' : '') + '</button>';
      }).join('');
      return '<div class="bd-group"><h3>' + g.label + '</h3><div class="bd-chips">' + chips + '</div></div>';
    }).join('');
  }

  /* ---------------------------------------------------------
     Homepage Spotlight — animated flagship highlight carousel
  --------------------------------------------------------- */
  var spotlightTimer = null;
  var spotlightIndex = 0;
  var spotlightIds = [];

  function renderSpotlight() {
    var track = $('#spotlightTrack');
    var dots = $('#spotlightDots');
    if (!track || !dots) return;

    var picks = state.products.filter(function (p) {
      return p.tags.indexOf('new') !== -1 && p.category === 'smartphones';
    }).sort(function (a, b) { return b.price - a.price; }).slice(0, 5);

    if (!picks.length) {
      picks = state.products.slice().sort(function (a, b) { return b.rating - a.rating; }).slice(0, 3);
    }

    spotlightIds = picks.map(function (p) { return p.id; });

    track.innerHTML = picks.map(function (p, i) {
      var desc = p.description.length > 118 ? p.description.slice(0, 118) + '…' : p.description;
      return '' +
        '<div class="spotlight-item' + (i === 0 ? ' active' : '') + '" data-id="' + p.id + '">' +
        '<div class="spotlight-media"><img src="' + p.images[0] + '" alt="' + escapeHtml(p.name) + '" loading="lazy"></div>' +
        '<div class="spotlight-info">' +
        '<span class="spotlight-brand">' + escapeHtml(p.brand) + ' · Just landed</span>' +
        '<h3>' + escapeHtml(p.name) + '</h3>' +
        '<p>' + escapeHtml(desc) + '</p>' +
        '<div class="spotlight-price-row"><span class="spotlight-price">' + formatMoney(p.price) + '</span>' +
        (p.oldPrice ? '<span class="spotlight-old">' + formatMoney(p.oldPrice) + '</span>' : '') +
        '</div>' +
        '<button class="btn spotlight-cta" data-action="spotlight-view" data-id="' + p.id + '">View Product <span aria-hidden="true">→</span></button>' +
        '</div>' +
        '</div>';
    }).join('');

    dots.innerHTML = picks.length > 1 ? picks.map(function (p, i) {
      return '<button type="button" class="spotlight-dot' + (i === 0 ? ' active' : '') + '" data-index="' + i + '" aria-label="Show highlight ' + (i + 1) + '"></button>';
    }).join('') : '';

    startSpotlightRotation(picks.length);
  }

  function setSpotlightSlide(i) {
    spotlightIndex = i;
    $$('.spotlight-item').forEach(function (el, idx) { el.classList.toggle('active', idx === i); });
    $$('.spotlight-dot').forEach(function (el, idx) { el.classList.toggle('active', idx === i); });
  }

  function startSpotlightRotation(count) {
    if (spotlightTimer) { clearInterval(spotlightTimer); spotlightTimer = null; }
    spotlightIndex = 0;
    if (count <= 1) return;
    spotlightTimer = setInterval(function () {
      setSpotlightSlide((spotlightIndex + 1) % count);
    }, 4500);
  }

  function applyFiltersAndRender() {
    renderCategoryTabs();
    renderGrid();
  }

  /* ---------------------------------------------------------
     Product modal
  --------------------------------------------------------- */
  function openProductModal(id) {
    var p = getProduct(id);
    if (!p) return;
    var body = $('#productModalBody');
    var stockClass = p.stock === 0 ? '' : p.stock <= 5 ? 'low' : 'in';
    var stockText = p.stock === 0 ? '❌ Out of stock' : p.stock <= 5 ? '⚠️ Only ' + p.stock + ' left in stock' : '✅ In stock';

    var specsHTML = Object.keys(p.specs).map(function (k) {
      return '<li><b>' + escapeHtml(k) + ':</b> ' + escapeHtml(p.specs[k]) + '</li>';
    }).join('');

    var thumbs = p.images.length > 1 ? p.images.map(function (src, i) {
      return '<img src="' + src + '" data-i="' + i + '" class="' + (i === 0 ? 'active' : '') + '" alt="thumbnail ' + (i + 1) + '">';
    }).join('') : '';

    body.innerHTML =
      '<div class="pm-gallery">' +
      '<img id="pmMainImg" src="' + p.images[0] + '" alt="' + escapeHtml(p.name) + '" loading="lazy">' +
      (thumbs ? '<div class="pm-thumbs">' + thumbs + '</div>' : '') +
      '</div>' +
      '<div class="pm-info">' +
      '<div class="pm-brand">' + escapeHtml(p.brand) + ' · ' + escapeHtml(p.categoryName) + '</div>' +
      '<h2 class="pm-name">' + escapeHtml(p.name) + '</h2>' +
      '<div class="pm-rating">' + renderStars(p.rating) + ' ' + p.rating.toFixed(1) + ' (' + p.reviews + ' reviews)</div>' +
      '<div class="pm-price-row"><span class="pm-price">' + formatMoney(p.price) + '</span>' +
      (p.oldPrice ? '<span class="pm-old-price">' + formatMoney(p.oldPrice) + '</span><span class="pc-badge sale">-' + p.discountPct + '%</span>' : '') +
      '</div>' +
      '<div class="pm-stock ' + stockClass + '">' + stockText + '</div>' +
      '<p>' + escapeHtml(p.description) + '</p>' +
      '<ul class="pm-specs">' + specsHTML + '</ul>' +
      '<div class="pm-qty-row"><span>Qty</span><div class="pm-qty">' +
      '<button class="qty-btn" id="pmQtyDec">−</button><span id="pmQtyVal">1</span><button class="qty-btn" id="pmQtyInc">+</button>' +
      '</div></div>' +
      '<div class="pm-actions">' +
      '<button class="btn btn-primary" id="pmAddCart"' + (p.stock === 0 ? ' disabled' : '') + '>🛒 Add to Cart</button>' +
      '<button class="btn btn-outline" id="pmWish">' + (isWished(p.id) ? '♥ Wishlisted' : '♡ Add to Wishlist') + '</button>' +
      '<button class="btn btn-outline" id="pmWhatsapp" type="button">💬 Ask on WhatsApp</button>' +
      '</div>' +
      '</div>';

    var qty = 1;
    $('#pmQtyDec').addEventListener('click', function () { qty = Math.max(1, qty - 1); $('#pmQtyVal').textContent = qty; });
    $('#pmQtyInc').addEventListener('click', function () { qty = Math.min(p.stock || 99, qty + 1); $('#pmQtyVal').textContent = qty; });
    $('#pmAddCart').addEventListener('click', function () {
      addToCart(p.id, qty);
      toast(p.name + ' added to cart', 'success');
      pulse($('#cartBtn'));
    });
    $('#pmWish').addEventListener('click', function (e) {
      toggleWishlist(p.id);
      e.target.textContent = isWished(p.id) ? '♥ Wishlisted' : '♡ Add to Wishlist';
      renderGrid();
    });
    $('#pmWhatsapp').addEventListener('click', function () {
      var msg = 'Hi PhoneSouq Kuwait, I would like to ask about: ' + p.name + ' (' + formatMoney(p.price) + '). Is it available?';
      window.open(waLink(msg), '_blank', 'noopener');
      if (window.Tracking) Tracking.trackEvent('whatsapp_click', { context: 'product', id: p.id });
    });
    $$('.pm-thumbs img', body).forEach(function (img) {
      img.addEventListener('click', function () {
        $('#pmMainImg').src = img.src;
        $$('.pm-thumbs img', body).forEach(function (t) { t.classList.remove('active'); });
        img.classList.add('active');
      });
    });

    $('#productModal').classList.add('open');
    $('#productOverlay').classList.add('open');
    document.body.style.overflow = 'hidden';

    if (window.Tracking) Tracking.trackEvent('view_item', { id: p.id, name: p.name, brand: p.brand, price: p.price });
  }

  function closeProductModal() {
    $('#productModal').classList.remove('open');
    $('#productOverlay').classList.remove('open');
    document.body.style.overflow = '';
  }

  function pulse(el) {
    if (!el) return;
    el.classList.remove('bump');
    void el.offsetWidth;
    el.classList.add('bump');
  }

  /* ---------------------------------------------------------
     Checkout
  --------------------------------------------------------- */
  var checkoutStep = 1;
  function setCheckoutStep(n) {
    checkoutStep = n;
    $$('.checkout-panel').forEach(function (p) { p.classList.toggle('active', Number(p.dataset.panel) === n); });
    $$('.cstep').forEach(function (s) { s.classList.toggle('active', Number(s.dataset.step) <= n); });
    if (n === 3) renderReview();
  }

  function currentPayMethod() {
    var checked = $('input[name="payMethod"]:checked');
    return checked ? checked.value : 'knet';
  }

  function updatePayMethodUI(method) {
    $$('.pay-method').forEach(function (l) { l.classList.toggle('active', l.querySelector('input').value === method); });
    var cardWrap = $('#cardFieldsWrap');
    var codHint = $('#codHint');
    if (method === 'card') {
      cardWrap.hidden = false;
      $('#coCard').required = true; $('#coExp').required = true; $('#coCvc').required = true;
      codHint.hidden = true;
    } else {
      cardWrap.hidden = true;
      $('#coCard').required = false; $('#coExp').required = false; $('#coCvc').required = false;
      codHint.hidden = method !== 'cod';
    }
  }

  var PAY_LABELS = { knet: 'KNET', card: 'Credit/Debit Card', cod: 'Cash on Delivery' };

  function renderReview() {
    var lines = cartLines();
    $('#reviewItems').innerHTML = lines.map(function (l) {
      return '<div class="review-item-row"><span>' + l.qty + ' × ' + escapeHtml(l.product.name) + '</span><span>' + formatMoney(l.product.price * l.qty) + '</span></div>';
    }).join('') + '<div class="review-item-row"><span>Payment method</span><span>' + PAY_LABELS[currentPayMethod()] + '</span></div>';
    var t = cartTotals();
    $('#reviewTotals').innerHTML =
      '<div class="cart-line"><span>Subtotal</span><span>' + formatMoney(t.subtotal) + '</span></div>' +
      '<div class="cart-line"><span>Delivery</span><span>' + (t.shipping === 0 ? 'FREE' : formatMoney(t.shipping)) + '</span></div>' +
      '<div class="cart-line cart-total"><span>Total</span><span>' + formatMoney(t.total) + '</span></div>';
  }

  function openCheckout() {
    if (cartLines().length === 0) { toast('Your cart is empty', 'error'); return; }
    closeCart();
    setCheckoutStep(1);
    updatePayMethodUI('knet');
    $$('input[name="payMethod"]').forEach(function (r) { r.checked = r.value === 'knet'; });
    if (window.Auth) {
      var customer = Auth.currentCustomer();
      if (customer) {
        $('#coName').value = customer.name;
        $('#coEmail').value = customer.email;
        $('#coPhone').value = customer.phone || '';
      }
    }
    $('#checkoutModal').classList.add('open');
    $('#checkoutOverlay').classList.add('open');
    document.body.style.overflow = 'hidden';
    if (window.Tracking) Tracking.trackEvent('begin_checkout', { value: cartTotals().total, items: cartLines().length });
  }
  function closeCheckout() {
    $('#checkoutModal').classList.remove('open');
    $('#checkoutOverlay').classList.remove('open');
    document.body.style.overflow = '';
  }

  var lastOrderId = null;
  function placeOrder(e) {
    e.preventDefault();
    var lines = cartLines();
    if (lines.length === 0) return;
    var totals = cartTotals();
    var order = {
      email: $('#coEmail').value.trim(),
      paymentMethod: currentPayMethod(),
      customer: {
        name: $('#coName').value.trim(),
        email: $('#coEmail').value.trim(),
        phone: $('#coPhone').value.trim(),
        governorate: $('#coGovernorate').value,
        area: $('#coCity').value.trim(),
        address: $('#coAddress').value.trim()
      },
      items: lines.map(function (l) { return { id: l.product.id, name: l.product.name, brand: l.product.brand, price: l.product.price, qty: l.qty, img: l.product.images[0] }; }),
      totals: totals
    };
    var record = window.Tracking.createOrder(order);
    lastOrderId = record.id;

    if (window.Tracking) Tracking.trackEvent('purchase', { orderId: record.id, value: totals.total, items: lines.length });

    state.cart = [];
    saveCart();
    updateCartBadge();
    renderCart();

    $('#confirmOrderId').textContent = record.id;
    $('#confirmWhatsapp').href = waLink('Hi PhoneSouq Kuwait, I just placed order ' + record.id + ' (' + formatMoney(totals.total) + '). I have a question about it.');
    setCheckoutStep(4);
    toast('Order placed! ID: ' + record.id, 'success');
  }

  /* ---------------------------------------------------------
     Routing
  --------------------------------------------------------- */
  function currentPath() {
    var h = location.hash || '#/';
    return h.indexOf('#/') === 0 ? h.slice(1) : null;
  }
  function navigate(path) { location.hash = '#' + path; }

  function handleRoute() {
    var path = currentPath();
    if (path === null) return;
    closeMobileNav();

    $$('.view').forEach(function (v) { v.hidden = (v.dataset.view !== path); });
    $$('[data-route]').forEach(function (a) { a.classList.toggle('active', a.getAttribute('data-route') === path); });

    if (path !== '/') window.scrollTo({ top: 0, behavior: 'smooth' });
    if (path === '/admin') renderAdminEntry();
    if (path === '/track') { $('#trackResult').hidden = true; $('#trackError').hidden = true; }
    if (path === '/account') renderAccountView();

    if (window.Tracking) Tracking.trackEvent('page_view', { path: path });
  }

  /* ---------------------------------------------------------
     Order tracking view
  --------------------------------------------------------- */
  var trackPollTimer = null;
  function renderOrderTracking(order) {
    clearInterval(trackPollTimer);
    var resultEl = $('#trackResult');

    function paint() {
      var s = window.Tracking.computeOrderStatus(order);
      var pct = (s.currentIndex / (s.steps.length - 1)) * 100;
      resultEl.innerHTML =
        '<div class="track-order-head">' +
        '<div><div class="track-order-id">Order ' + order.id + '</div>' +
        '<div class="hint">Placed ' + new Date(order.createdAt).toLocaleString() + ' · ' + (PAY_LABELS[order.paymentMethod] || 'KNET') + '</div></div>' +
        '<span class="track-status-pill">' + s.currentStep.icon + ' ' + s.currentStep.label + '</span>' +
        '</div>' +
        '<div class="timeline">' +
        '<div class="timeline-fill" style="width:' + pct + '%"></div>' +
        s.steps.map(function (st) {
          return '<div class="tl-step ' + (st.done ? 'done' : st.active ? 'active' : '') + '">' +
            '<div class="tl-dot">' + (st.done ? '✓' : st.icon) + '</div>' +
            '<div class="tl-label">' + st.label + '</div>' +
            '<div class="tl-time">' + (st.done || st.active ? st.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—') + '</div>' +
            '</div>';
        }).join('') +
        '</div>' +
        '<div class="track-items">' +
        order.items.map(function (it) {
          return '<div class="track-item-row"><span>' + it.qty + ' × ' + escapeHtml(it.name) + '</span><span>' + formatMoney(it.price * it.qty) + '</span></div>';
        }).join('') +
        '<div class="track-item-row" style="font-weight:800;color:var(--text)"><span>Total</span><span>' + formatMoney(order.totals.total) + '</span></div>' +
        '</div>';

      if (s.isFinal) clearInterval(trackPollTimer);
    }

    paint();
    resultEl.hidden = false;
    $('#trackError').hidden = true;
    trackPollTimer = setInterval(paint, 2000);
  }

  /* ---------------------------------------------------------
     Admin
  --------------------------------------------------------- */
  var ADMIN_USERNAME = 'admin';
  var ADMIN_PASSWORD = 'P@ssw0rd';
  var ADMIN_KEY = 'en_admin_session';

  function isAdminLoggedIn() { return sessionStorage.getItem(ADMIN_KEY) === 'true'; }

  function renderAdminEntry() {
    if (isAdminLoggedIn()) {
      $('#adminLogin').hidden = true;
      $('#adminPanel').hidden = false;
      renderAdminAll();
    } else {
      $('#adminLogin').hidden = false;
      $('#adminPanel').hidden = true;
    }
  }

  function renderAdminAll() {
    renderAnalytics();
    renderManageList();
    renderOrdersList();
    populateCategorySelect();
  }

  function populateCategorySelect() {
    var sel = $('#apCategory');
    if (sel.options.length) return;
    sel.innerHTML = CATEGORIES.map(function (c) { return '<option value="' + c.id + '">' + c.icon + ' ' + c.name + '</option>'; }).join('');
  }

  function renderAnalytics() {
    if (!window.Tracking) return;
    var events = Tracking.getEvents();
    var orders = Tracking.getOrders();

    var pageViews = events.filter(function (e) { return e.name === 'page_view'; }).length;
    var productViews = events.filter(function (e) { return e.name === 'view_item'; }).length;
    var addToCart = events.filter(function (e) { return e.name === 'add_to_cart'; }).length;
    var purchases = events.filter(function (e) { return e.name === 'purchase'; }).length;
    var revenue = orders.reduce(function (s, o) { return s + (o.totals ? o.totals.total : 0); }, 0);
    var conv = pageViews ? (purchases / pageViews * 100) : 0;
    var aov = purchases ? (revenue / purchases) : 0;

    $('#statCards').innerHTML = [
      { label: 'Page Views', value: pageViews, sub: 'all-time (this browser)' },
      { label: 'Product Views', value: productViews, sub: '' },
      { label: 'Add to Cart', value: addToCart, sub: '' },
      { label: 'Orders', value: orders.length, sub: '' },
      { label: 'Revenue', value: formatMoney(revenue), sub: '' },
      { label: 'Avg. Order Value', value: formatMoney(aov), sub: '' },
      { label: 'Conversion Rate', value: conv.toFixed(1) + '%', sub: 'views → purchase' }
    ].map(function (c) {
      return '<div class="stat-card"><div class="sc-label">' + c.label + '</div><div class="sc-value">' + c.value + '</div>' + (c.sub ? '<div class="sc-sub">' + c.sub + '</div>' : '') + '</div>';
    }).join('');

    var funnelSteps = [
      { label: 'Page Views', val: pageViews },
      { label: 'Product Views', val: productViews },
      { label: 'Add to Cart', val: addToCart },
      { label: 'Checkout Started', val: events.filter(function (e) { return e.name === 'begin_checkout'; }).length },
      { label: 'Purchases', val: purchases }
    ];
    var max = Math.max(1, funnelSteps[0].val);
    $('#funnelChart').innerHTML = funnelSteps.map(function (s) {
      var pct = Math.round(s.val / max * 100);
      return '<div class="funnel-row"><span class="funnel-label">' + s.label + '</span>' +
        '<div class="funnel-bar-wrap"><div class="funnel-bar" style="width:' + pct + '%">' + s.val + '</div></div></div>';
    }).join('');

    var byProduct = {};
    events.filter(function (e) { return e.name === 'view_item'; }).forEach(function (e) {
      var name = e.data && e.data.name || 'Unknown';
      byProduct[name] = (byProduct[name] || 0) + 1;
    });
    var top = Object.keys(byProduct).map(function (k) { return { name: k, count: byProduct[k] }; })
      .sort(function (a, b) { return b.count - a.count; }).slice(0, 6);
    var topMax = Math.max(1, top[0] ? top[0].count : 1);
    $('#topProductsChart').innerHTML = top.length ? top.map(function (t) {
      return '<div class="bar-row"><span class="bar-label" title="' + escapeHtml(t.name) + '">' + escapeHtml(t.name) + '</span>' +
        '<div class="bar-wrap"><div class="bar-fill" style="width:' + (t.count / topMax * 100) + '%"></div></div>' +
        '<span class="bar-val">' + t.count + '</span></div>';
    }).join('') : '<p class="hint">No product views recorded yet — browse the shop to generate data.</p>';

    var recent = events.slice(-40).reverse();
    $('#eventLog').innerHTML = recent.length ? recent.map(function (e) {
      var meta = '';
      if (e.name === 'view_item' || e.name === 'add_to_cart') meta = e.data.name || '';
      if (e.name === 'purchase') meta = e.data.orderId + ' · ' + formatMoney(e.data.value || 0);
      if (e.name === 'page_view') meta = e.data.path || '/';
      return '<div class="event-row"><span><b>' + e.name + '</b> ' + escapeHtml(meta) + '</span><span>' + new Date(e.ts).toLocaleTimeString() + '</span></div>';
    }).join('') : '<p class="hint">No activity yet.</p>';
  }

  function renderManageList() {
    var custom = loadJSON(LS.customProducts, []);
    var el = $('#manageList');
    el.innerHTML = custom.length ? custom.map(function (p) {
      var oos = p.stock === 0;
      var stockChip = '<span class="manage-stock-chip ' + (oos ? 'out' : p.stock <= 5 ? 'low' : 'in') + '">' +
        (oos ? '● Out of Stock' : p.stock <= 5 ? '● Only ' + p.stock + ' left' : '● In Stock (' + p.stock + ')') + '</span>';
      var discountChip = p.oldPrice ? '<span class="manage-discount-chip">-' + p.discountPct + '% off</span>' : '';
      return '<div class="manage-row" data-id="' + p.id + '">' +
        '<img class="manage-thumb" src="' + p.images[0] + '" alt="">' +
        '<div class="manage-info"><b>' + escapeHtml(p.name) + '</b>' + escapeHtml(p.brand) + ' · ' + formatMoney(p.price) +
        (p.oldPrice ? ' <s class="manage-old-price">' + formatMoney(p.oldPrice) + '</s>' : '') +
        '<div class="manage-chips">' + stockChip + discountChip + '</div></div>' +
        '<button class="btn btn-outline btn-sm" data-action="edit-product">✏️ Edit</button>' +
        '<button class="btn btn-outline btn-sm" data-action="delete-product">🗑️ Delete</button>' +
        '</div>';
    }).join('') : '<p class="hint">No custom products added yet. Use the "Add Product" tab.</p>';
  }

  function renderOrdersList() {
    var orders = window.Tracking ? Tracking.getOrders() : [];
    var el = $('#ordersList');
    el.innerHTML = orders.length ? orders.map(function (o) {
      var s = window.Tracking.computeOrderStatus(o);
      return '<div class="order-row" data-order-id="' + o.id + '">' +
        '<div class="manage-info"><b>' + o.id + '</b>' + escapeHtml(o.customer.name) + ' · ' + escapeHtml(o.customer.governorate || '') + '</div>' +
        '<span class="order-status-chip">' + s.currentStep.icon + ' ' + s.currentStep.label + '</span>' +
        '<div style="font-weight:700">' + formatMoney(o.totals.total) + '</div>' +
        '<button class="btn btn-outline btn-sm" data-action="view-invoice">🧾 Invoice</button>' +
        '</div>';
    }).join('') : '<p class="hint">No orders placed yet.</p>';
  }

  /* ---------------------------------------------------------
     Invoice generation (admin → Orders tab)
  --------------------------------------------------------- */
  function invoiceHTML(order) {
    var itemsRows = order.items.map(function (it) {
      var lineTotal = it.price * it.qty;
      return '<tr><td>' + escapeHtml(it.name) + '<br><span class="inv-item-brand">' + escapeHtml(it.brand || '') + '</span></td>' +
        '<td>' + it.qty + '</td><td>' + formatMoney(it.price) + '</td><td>' + formatMoney(lineTotal) + '</td></tr>';
    }).join('');
    var payLabel = order.paymentMethod === 'knet' ? 'KNET' : order.paymentMethod === 'card' ? 'Credit / Debit Card' : 'Cash on Delivery';
    var dateStr = new Date(order.createdAt).toLocaleString();
    return '' +
      '<div class="invoice-paper">' +
      '<div class="invoice-head">' +
      '<div class="invoice-brand"><span class="logo-mark">📱</span> Phone<span class="accent">Souq</span> <span class="inv-kw">Kuwait</span></div>' +
      '<div class="invoice-meta"><h2>INVOICE</h2><div>Order <b>' + escapeHtml(order.id) + '</b></div><div>' + dateStr + '</div></div>' +
      '</div>' +
      '<div class="invoice-parties">' +
      '<div><h4>Billed to</h4><p>' + escapeHtml(order.customer.name) + '<br>' + escapeHtml(order.customer.phone || '') + '<br>' + escapeHtml(order.email || '') + '<br>' +
      escapeHtml(order.customer.address || '') + (order.customer.area ? ', ' + escapeHtml(order.customer.area) : '') + '<br>' + escapeHtml(order.customer.governorate || '') + ', Kuwait</p></div>' +
      '<div><h4>Payment</h4><p>Method: ' + escapeHtml(payLabel) + '<br>Status: Confirmed<br>Currency: KD</p></div>' +
      '</div>' +
      '<table class="invoice-table"><thead><tr><th>Item</th><th>Qty</th><th>Unit Price</th><th>Total</th></tr></thead>' +
      '<tbody>' + itemsRows + '</tbody></table>' +
      '<div class="invoice-totals">' +
      '<div class="inv-total-row"><span>Subtotal</span><span>' + formatMoney(order.totals.subtotal) + '</span></div>' +
      '<div class="inv-total-row"><span>Delivery</span><span>' + (order.totals.shipping === 0 ? 'FREE' : formatMoney(order.totals.shipping)) + '</span></div>' +
      '<div class="inv-total-row grand"><span>Total</span><span>' + formatMoney(order.totals.total) + '</span></div>' +
      '</div>' +
      '<p class="invoice-footer">Thank you for shopping with PhoneSouq Kuwait. This is a system-generated invoice — no signature required. Demo store, no real payment was processed.</p>' +
      '</div>';
  }

  function openInvoice(order) {
    $('#invoiceContent').innerHTML = invoiceHTML(order);
    $('#invoiceModal').classList.add('open');
    $('#invoiceOverlay').classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeInvoice() {
    $('#invoiceModal').classList.remove('open');
    $('#invoiceOverlay').classList.remove('open');
    document.body.style.overflow = '';
  }

  function computeDiscount(price, oldPriceRaw) {
    var oldPrice = Number(oldPriceRaw) || 0;
    if (!oldPrice || oldPrice <= price) return { oldPrice: null, discountPct: 0 };
    return { oldPrice: oldPrice, discountPct: Math.round((oldPrice - price) / oldPrice * 100) };
  }

  function updateCustomProduct(id, data, photoDataUrl) {
    var custom = loadJSON(LS.customProducts, []);
    var existing = custom.find(function (p) { return p.id === id; });
    if (!existing) return null;
    var cat = CAT_MAP[data.category];
    var disc = computeDiscount(data.price, data.oldPrice);
    existing.name = data.name;
    existing.brand = data.brand;
    existing.brandId = slugify(data.brand);
    existing.category = data.category;
    existing.categoryName = cat.name;
    existing.price = data.price;
    existing.oldPrice = disc.oldPrice;
    existing.discountPct = disc.discountPct;
    existing.rating = data.rating;
    existing.stock = data.stock;
    existing.description = data.description;
    existing.tags = existing.tags.filter(function (t) { return t !== 'sale'; });
    if (disc.oldPrice) existing.tags.push('sale');
    if (photoDataUrl) existing.images = [photoDataUrl, photoDataUrl];
    saveJSON(LS.customProducts, custom);
    refreshProducts();
    if (window.Tracking) Tracking.trackEvent('admin_edit_product', { id: existing.id, name: existing.name });
    return existing;
  }

  function getCustomProduct(id) {
    return loadJSON(LS.customProducts, []).find(function (p) { return p.id === id; }) || null;
  }

  function addCustomProduct(data, photoDataUrl) {
    var cat = CAT_MAP[data.category];
    var colors = colorFor(data.brand);
    var img1 = photoDataUrl || productImage(data.brand, data.name, cat.icon, colors[0], colors[1]);
    var img2 = photoDataUrl || productImage(data.brand, data.name + ' — detail', cat.icon, colors[1], colors[0]);
    var disc = computeDiscount(data.price, data.oldPrice);
    var tags = ['new'];
    if (disc.oldPrice) tags.push('sale');
    var product = {
      id: uid('custom'),
      idx: 9999,
      name: data.name,
      brand: data.brand,
      brandId: slugify(data.brand),
      category: data.category,
      categoryName: cat.name,
      price: data.price,
      oldPrice: disc.oldPrice,
      discountPct: disc.discountPct,
      rating: data.rating,
      reviews: 0,
      stock: data.stock,
      tags: tags,
      description: data.description,
      specs: { Brand: data.brand, Category: cat.name, Added: new Date().toLocaleDateString() },
      images: [img1, img2],
      custom: true,
      createdAt: Date.now()
    };
    var custom = loadJSON(LS.customProducts, []);
    custom.push(product);
    saveJSON(LS.customProducts, custom);
    refreshProducts();
    if (window.Tracking) Tracking.trackEvent('admin_add_product', { id: product.id, name: product.name });
    return product;
  }

  function deleteCustomProduct(id) {
    var custom = loadJSON(LS.customProducts, []).filter(function (p) { return p.id !== id; });
    saveJSON(LS.customProducts, custom);
    refreshProducts();
  }

  /* ---------------------------------------------------------
     Customer account view (/account)
  --------------------------------------------------------- */
  function renderAccountView() {
    if (!window.Auth) return;
    var customer = Auth.currentCustomer();
    if (customer) {
      $('#authLoggedOut').hidden = true;
      $('#authLoggedIn').hidden = false;
      $('#acctName').textContent = customer.name;
      $('#acctEmail').textContent = customer.email;
      $('#acctNameInput').value = customer.name;
      $('#acctPhoneInput').value = customer.phone || '';
      var orders = window.Tracking ? Tracking.getOrders().filter(function (o) {
        return (o.email || '').toLowerCase() === customer.email.toLowerCase();
      }) : [];
      var el = $('#acctOrders');
      el.innerHTML = orders.length ? orders.map(function (o) {
        var s = window.Tracking.computeOrderStatus(o);
        return '<div class="order-row">' +
          '<div class="manage-info"><b>' + o.id + '</b>' + new Date(o.createdAt).toLocaleDateString() + '</div>' +
          '<span class="order-status-chip">' + s.currentStep.icon + ' ' + s.currentStep.label + '</span>' +
          '<div style="font-weight:700">' + formatMoney(o.totals.total) + '</div>' +
          '</div>';
      }).join('') : '<p class="hint">No orders yet on this account. <a href="#shop-grid">Start shopping</a>.</p>';
    } else {
      $('#authLoggedOut').hidden = false;
      $('#authLoggedIn').hidden = true;
    }
  }

  function wireAuthEvents() {
    if (!window.Auth) return;

    // login/signup tab switching
    $$('.auth-tab').forEach(function (tab) {
      tab.addEventListener('click', function () {
        $$('.auth-tab').forEach(function (t) { t.classList.toggle('active', t === tab); });
        $$('.auth-panel').forEach(function (p) {
          var show = p.dataset.authPanel === tab.dataset.authTab;
          p.classList.toggle('active', show);
          p.hidden = !show;
        });
      });
    });

    // password show/hide toggles
    $$('.pw-toggle').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var input = document.getElementById(btn.dataset.toggle);
        input.type = input.type === 'password' ? 'text' : 'password';
      });
    });

    // live password strength meter
    $('#signupPassword').addEventListener('input', function () {
      var s = Auth.passwordStrength(this.value);
      var bar = $('#pwStrengthBar');
      var wrap = $('#pwStrength');
      var label = $('#pwStrengthLabel');
      if (!this.value) { wrap.hidden = true; label.textContent = ''; return; }
      wrap.hidden = false;
      bar.className = 'pw-strength-bar' + (s.score === 1 ? '' : s.score === 2 ? ' medium' : s.score >= 3 ? ' strong' : '');
      bar.style.width = (s.score === 0 ? 15 : s.score * 33) + '%';
      label.textContent = 'Password strength: ' + s.label;
    });

    $('#loginForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var email = $('#loginEmail').value.trim();
      var pw = $('#loginPassword').value;
      var errEl = $('#loginError');
      Auth.login(email, pw).then(function (res) {
        if (res.ok) {
          errEl.hidden = true;
          this.reset();
          if (window.Tracking) Tracking.trackEvent('customer_login', {});
          toast('Welcome back, ' + res.customer.name + '!', 'success');
          renderAccountView();
        } else {
          errEl.textContent = res.error;
          errEl.hidden = false;
        }
      }.bind(this));
    });

    $('#signupForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var errEl = $('#signupError');
      var data = {
        name: $('#signupName').value, email: $('#signupEmail').value, phone: $('#signupPhone').value,
        password: $('#signupPassword').value, confirmPassword: $('#signupConfirm').value
      };
      Auth.signup(data).then(function (res) {
        if (res.ok) {
          errEl.hidden = true;
          this.reset();
          if (window.Tracking) Tracking.trackEvent('customer_signup', {});
          toast('Account created — welcome, ' + res.customer.name + '!', 'success');
          renderAccountView();
        } else {
          errEl.textContent = res.error;
          errEl.hidden = false;
        }
      }.bind(this));
    });

    $('#saveProfileBtn').addEventListener('click', function () {
      var customer = Auth.currentCustomer();
      if (!customer) return;
      var res = Auth.updateProfile(customer.id, { name: $('#acctNameInput').value, phone: $('#acctPhoneInput').value });
      if (res.ok) {
        $('#profileSuccess').hidden = false;
        $('#acctName').textContent = res.customer.name;
        setTimeout(function () { $('#profileSuccess').hidden = true; }, 2500);
      }
    });

    $('#changePwBtn').addEventListener('click', function () {
      var customer = Auth.currentCustomer();
      if (!customer) return;
      var errEl = $('#changePwError');
      Auth.changePassword(customer.id, $('#cpCurrent').value, $('#cpNew').value).then(function (res) {
        if (res.ok) {
          errEl.hidden = true;
          $('#changePwSuccess').hidden = false;
          $('#cpCurrent').value = ''; $('#cpNew').value = '';
          setTimeout(function () { $('#changePwSuccess').hidden = true; }, 2500);
        } else {
          errEl.textContent = res.error;
          errEl.hidden = false;
        }
      });
    });

    $('#logoutBtn').addEventListener('click', function () {
      Auth.logout();
      toast('Logged out', 'info');
      renderAccountView();
    });

    $('#waForgotPassword').addEventListener('click', function (e) {
      e.preventDefault();
      window.open(waLink('Hi PhoneSouq Kuwait, I forgot my account password and need help resetting it.'), '_blank', 'noopener');
    });
  }

  /* ---------------------------------------------------------
     Theme / header scroll / reveal / counters / misc UI
  --------------------------------------------------------- */
  function initTheme() {
    var saved = localStorage.getItem(LS.theme);
    if (saved === 'dark') document.body.classList.add('dark');
    updateThemeIcon();
  }
  function updateThemeIcon() {
    $('#themeToggle').textContent = document.body.classList.contains('dark') ? '☀️' : '🌙';
  }
  function toggleTheme() {
    document.body.classList.toggle('dark');
    localStorage.setItem(LS.theme, document.body.classList.contains('dark') ? 'dark' : 'light');
    updateThemeIcon();
  }

  function initHeaderScroll() {
    var header = $('#siteHeader');
    var backTop = $('#backToTop');
    window.addEventListener('scroll', debounce(function () {
      var y = window.scrollY;
      header.classList.toggle('scrolled', y > 10);
      backTop.classList.toggle('show', y > 500);
    }, 30));
  }

  function initReveal() {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('visible'); io.unobserve(e.target); }
      });
    }, { threshold: 0.15 });
    $$('.reveal').forEach(function (el) { io.observe(el); });
  }

  function initCounters() {
    var statEls = $$('.stat-num');
    if (!statEls.length) return;
    var done = false;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting && !done) {
          done = true;
          statEls.forEach(function (el) {
            var target = Number(el.dataset.count);
            var isDecimal = el.dataset.decimal === 'true';
            var start = performance.now();
            var duration = 1200;
            function step(now) {
              var p = Math.min(1, (now - start) / duration);
              var eased = 1 - Math.pow(1 - p, 3);
              var val = target * eased;
              el.textContent = isDecimal ? (val / 10).toFixed(1) : Math.round(val).toLocaleString();
              if (p < 1) requestAnimationFrame(step);
            }
            requestAnimationFrame(step);
          });
          io.disconnect();
        }
      });
    }, { threshold: 0.3 });
    io.observe($('.hero-stats'));
  }

  function closeMobileNav() { $('#mobileNav').classList.remove('open'); }

  /* ---------------------------------------------------------
     Search
  --------------------------------------------------------- */
  function renderSearchSuggestions(q) {
    var box = $('#searchSuggest');
    if (!q) { box.classList.remove('open'); box.innerHTML = ''; return; }
    var matches = state.products.filter(function (p) {
      return (p.name + ' ' + p.brand).toLowerCase().indexOf(q.toLowerCase()) !== -1;
    }).slice(0, 6);
    if (!matches.length) {
      box.innerHTML = '<div class="suggest-item"><span class="suggest-meta">No matches</span></div>';
    } else {
      box.innerHTML = matches.map(function (p) {
        return '<div class="suggest-item" data-id="' + p.id + '">' +
          '<img class="suggest-thumb" src="' + p.images[0] + '" alt="">' +
          '<div><div class="suggest-name">' + escapeHtml(p.name) + '</div><div class="suggest-meta">' + formatMoney(p.price) + '</div></div>' +
          '</div>';
      }).join('');
    }
    box.classList.add('open');
  }

  /* ---------------------------------------------------------
     Event wiring
  --------------------------------------------------------- */
  function wireEvents() {
    $('#themeToggle').addEventListener('click', toggleTheme);
    $('#hamburger').addEventListener('click', function () { $('#mobileNav').classList.toggle('open'); });

    window.addEventListener('hashchange', handleRoute);

    document.addEventListener('click', function (e) {
      var filterDeal = e.target.closest('[data-filter-deal]');
      if (filterDeal) { state.filters.dealsOnly = true; resetPaging(); applyFiltersAndRender(); }

      var a = e.target.closest('a[href^="#"]');
      if (!a) return;
      var hash = a.getAttribute('href');
      if (hash.indexOf('#/') === 0 || hash === '#' || hash.length < 2) return;
      var shopView = $('#view-shop');
      if (shopView && shopView.hidden) {
        e.preventDefault();
        navigate('/');
        setTimeout(function () {
          var target = document.getElementById(hash.slice(1));
          if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 80);
      }
    });

    $('#backToTop').addEventListener('click', function () { window.scrollTo({ top: 0, behavior: 'smooth' }); });

    var searchInput = $('#searchInput');
    searchInput.addEventListener('input', debounce(function () {
      renderSearchSuggestions(searchInput.value.trim());
    }, 150));
    searchInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        state.filters.search = searchInput.value.trim();
        if (window.Tracking) Tracking.trackEvent('search', { q: state.filters.search });
        navigate('/');
        resetPaging();
        applyFiltersAndRender();
        $('#searchSuggest').classList.remove('open');
        $('#shop-grid').scrollIntoView({ behavior: 'smooth' });
      }
    });
    $('#searchSuggest').addEventListener('click', function (e) {
      var item = e.target.closest('.suggest-item[data-id]');
      if (!item) return;
      $('#searchSuggest').classList.remove('open');
      searchInput.value = '';
      openProductModal(item.dataset.id);
    });
    document.addEventListener('click', function (e) {
      if (!e.target.closest('.nav-search')) $('#searchSuggest').classList.remove('open');
    });

    $('#catTabs').addEventListener('click', function (e) {
      var btn = e.target.closest('.cat-tab');
      if (!btn) return;
      state.filters.category = btn.dataset.cat;
      resetPaging();
      applyFiltersAndRender();
    });

    $('#sortSelect').addEventListener('change', function () {
      state.filters.sort = this.value;
      resetPaging();
      renderGrid();
    });

    $('#brandFilterList').addEventListener('change', function () {
      var checked = $$('#brandFilterList input:checked').map(function (i) { return i.value; });
      state.filters.brands = checked;
      resetPaging();
      renderGrid();
    });

    var priceRange = $('#priceRange');
    priceRange.addEventListener('input', function () {
      $('#priceRangeVal').textContent = this.value;
      state.filters.maxPrice = Number(this.value);
      resetPaging();
      renderGrid();
    });

    $('#ratingFilterList').addEventListener('change', function (e) {
      state.filters.minRating = Number(e.target.value);
      resetPaging();
      renderGrid();
    });

    $('#clearFilters').addEventListener('click', function () {
      state.filters = { category: 'all', brands: [], maxPrice: 700, minRating: 0, sort: 'featured', search: '', dealsOnly: false };
      $('#priceRange').value = 700;
      $('#priceRangeVal').textContent = 700;
      $('#sortSelect').value = 'featured';
      resetPaging();
      renderCategoryTabs();
      renderBrandFilterList();
      renderRatingFilterList();
      renderGrid();
    });

    $('#loadMoreBtn').addEventListener('click', function () {
      state.visibleCount += PAGE_SIZE;
      renderGrid();
    });

    $('#productGrid').addEventListener('click', function (e) {
      var card = e.target.closest('.product-card');
      if (!card) return;
      var id = card.dataset.id;
      var action = e.target.closest('[data-action]');
      if (!action) return;
      var act = action.dataset.action;
      if (act === 'open') openProductModal(id);
      else if (act === 'wish') {
        toggleWishlist(id);
        action.classList.toggle('active');
        action.textContent = isWished(id) ? '♥' : '♡';
      } else if (act === 'quickadd') {
        addToCart(id, 1);
        var p = getProduct(id);
        toast(p.name + ' added to cart', 'success');
        pulse($('#cartBtn'));
      }
    });

    $('#brandGrid').addEventListener('click', function (e) {
      var card = e.target.closest('.brand-card');
      if (!card) return;
      state.filters.brands = [card.dataset.brand];
      resetPaging();
      renderBrandFilterList();
      applyFiltersAndRender();
      $('#shop-grid').scrollIntoView({ behavior: 'smooth' });
    });

    var spotlightTrackEl = $('#spotlightTrack');
    if (spotlightTrackEl) {
      spotlightTrackEl.addEventListener('click', function (e) {
        var btn = e.target.closest('[data-action="spotlight-view"]');
        if (!btn) return;
        openProductModal(btn.dataset.id);
      });
      var spotlightSection = $('#spotlight');
      spotlightSection.addEventListener('mouseenter', function () { if (spotlightTimer) clearInterval(spotlightTimer); });
      spotlightSection.addEventListener('mouseleave', function () { startSpotlightRotation(spotlightIds.length); });
    }
    var spotlightDotsEl = $('#spotlightDots');
    if (spotlightDotsEl) {
      spotlightDotsEl.addEventListener('click', function (e) {
        var btn = e.target.closest('.spotlight-dot');
        if (!btn) return;
        if (spotlightTimer) clearInterval(spotlightTimer);
        setSpotlightSlide(Number(btn.dataset.index));
        startSpotlightRotation(spotlightIds.length);
      });
    }

    $('#brandDirectory').addEventListener('click', function (e) {
      var chip = e.target.closest('.bd-chip');
      if (!chip) return;
      state.filters.brands = [chip.dataset.brand];
      state.filters.category = 'all';
      resetPaging();
      renderCategoryTabs();
      renderGrid();
      navigate('/');
      $('#shop-grid').scrollIntoView({ behavior: 'smooth' });
    });

    var bdToggleBtn = $('#bdToggleBtn');
    if (bdToggleBtn) {
      bdToggleBtn.addEventListener('click', function () {
        var wrap = $('#brandDirectoryWrap');
        var open = wrap.classList.toggle('open');
        bdToggleBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
        bdToggleBtn.querySelector('span').textContent = open ? 'Hide brand directory' : 'Browse all brands (90+)';
        if (open) wrap.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      });
    }

    $('#cartBtn').addEventListener('click', openCart);
    $('#closeCart').addEventListener('click', closeCart);
    $('#cartOverlay').addEventListener('click', closeCart);
    $('#cartEmptyShop').addEventListener('click', closeCart);
    $('#cartItems').addEventListener('click', function (e) {
      var row = e.target.closest('.cart-item');
      if (!row) return;
      var id = row.dataset.id;
      var action = e.target.closest('[data-action]');
      if (!action) return;
      if (action.dataset.action === 'remove') removeFromCart(id);
      else if (action.dataset.action === 'inc') {
        var line = state.cart.find(function (c) { return c.id === id; });
        setQty(id, line.qty + 1);
      } else if (action.dataset.action === 'dec') {
        var line2 = state.cart.find(function (c) { return c.id === id; });
        if (line2.qty <= 1) removeFromCart(id); else setQty(id, line2.qty - 1);
      }
    });
    $('#checkoutBtn').addEventListener('click', openCheckout);

    $('#closeProductModal').addEventListener('click', closeProductModal);
    $('#productOverlay').addEventListener('click', closeProductModal);

    $('#closeCheckoutModal').addEventListener('click', closeCheckout);
    $('#checkoutOverlay').addEventListener('click', closeCheckout);
    document.addEventListener('click', function (e) {
      var next = e.target.closest('[data-next]');
      var back = e.target.closest('[data-back]');
      if (next) {
        var panel = next.closest('.checkout-panel');
        var inputs = $$('input[required], select[required]', panel);
        var valid = inputs.every(function (i) { return i.reportValidity(); });
        if (valid) setCheckoutStep(Number(next.dataset.next));
      }
      if (back) setCheckoutStep(Number(back.dataset.back));
    });
    $('#payMethodRow').addEventListener('change', function (e) {
      if (e.target.name === 'payMethod') updatePayMethodUI(e.target.value);
    });
    $('#checkoutForm').addEventListener('submit', placeOrder);
    $('#confirmCloseBtn').addEventListener('click', closeCheckout);
    $('#confirmTrackBtn').addEventListener('click', function () {
      closeCheckout();
      navigate('/track');
      setTimeout(function () {
        $('#trackOrderId').value = lastOrderId || '';
        $('#trackEmail').value = $('#coEmail').value || '';
      }, 50);
    });

    $('#coCard').addEventListener('input', function () {
      this.value = this.value.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim();
    });
    $('#coExp').addEventListener('input', function () {
      this.value = this.value.replace(/\D/g, '').slice(0, 4).replace(/(\d{2})(\d)/, '$1/$2');
    });

    $('#newsletterForm').addEventListener('submit', function (e) {
      e.preventDefault();
      if (window.Tracking) Tracking.trackEvent('newsletter_signup', {});
      toast('Subscribed! Check your inbox for 10% off 🎉', 'success');
      this.reset();
    });

    $('#trackForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var id = $('#trackOrderId').value.trim();
      var email = $('#trackEmail').value.trim();
      var order = window.Tracking.findOrder(id, email);
      if (window.Tracking) Tracking.trackEvent('order_track_lookup', { id: id, found: !!order });
      if (order) renderOrderTracking(order);
      else { $('#trackResult').hidden = true; $('#trackError').hidden = false; }
    });

    $('#adminLoginForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var user = $('#adminUsername').value.trim();
      var pw = $('#adminPassword').value;
      var errEl = $('#adminLoginError');
      if (window.Auth) {
        var lock = Auth.checkAdminLockout(user || 'admin');
        if (lock.locked) {
          errEl.textContent = 'Too many failed attempts. Try again in ' + Math.ceil(lock.remainingMs / 1000) + 's.';
          errEl.hidden = false;
          return;
        }
      }
      if (user === ADMIN_USERNAME && pw === ADMIN_PASSWORD) {
        if (window.Auth) Auth.recordAdminAttempt(user, true);
        sessionStorage.setItem(ADMIN_KEY, 'true');
        errEl.hidden = true;
        $('#adminPassword').value = '';
        if (window.Tracking) Tracking.trackEvent('admin_login', {});
        renderAdminEntry();
      } else {
        if (window.Auth) Auth.recordAdminAttempt(user || 'admin', false);
        errEl.textContent = 'Incorrect username or password.';
        errEl.hidden = false;
      }
    });

    $('#adminFab').addEventListener('click', function () { navigate('/admin'); });
    $('#accountBtn').addEventListener('click', function () { navigate('/account'); });
    $('#adminLogout').addEventListener('click', function () {
      sessionStorage.removeItem(ADMIN_KEY);
      renderAdminEntry();
    });

    $('.admin-tabs').addEventListener('click', function (e) {
      var btn = e.target.closest('.admin-tab');
      if (!btn) return;
      $$('.admin-tab').forEach(function (t) { t.classList.toggle('active', t === btn); });
      $$('.admin-tab-panel').forEach(function (p) { p.classList.toggle('active', p.id === 'tab-' + btn.dataset.tab); });
      if (btn.dataset.tab === 'analytics') renderAnalytics();
      if (btn.dataset.tab === 'manage') renderManageList();
      if (btn.dataset.tab === 'orders') renderOrdersList();
    });

    var pendingPhoto = null;
    $('#apPhoto').addEventListener('change', function (e) {
      var file = e.target.files[0];
      if (!file) { pendingPhoto = null; $('#apPreview').hidden = true; $('#apPreviewPlaceholder').hidden = false; return; }
      var reader = new FileReader();
      reader.onload = function (ev) {
        pendingPhoto = ev.target.result;
        $('#apPreview').src = pendingPhoto;
        $('#apPreview').hidden = false;
        $('#apPreviewPlaceholder').hidden = true;
      };
      reader.readAsDataURL(file);
    });

    function resetProductForm() {
      $('#addProductForm').reset();
      $('#apEditId').value = '';
      pendingPhoto = null;
      $('#apPreview').hidden = true;
      $('#apPreviewPlaceholder').hidden = false;
      $('#apFormTitle').textContent = '➕ Add a new product';
      $('#apSubmitBtn').textContent = 'Add Product';
      $('#apCancelEdit').hidden = true;
    }

    function enterEditMode(product) {
      $('#apEditId').value = product.id;
      $('#apName').value = product.name;
      $('#apBrand').value = product.brand;
      $('#apCategory').value = product.category;
      $('#apPrice').value = product.price;
      $('#apOldPrice').value = product.oldPrice || '';
      $('#apStock').value = product.stock;
      $('#apRating').value = product.rating;
      $('#apDesc').value = product.description;
      pendingPhoto = null;
      $('#apPreview').src = product.images[0];
      $('#apPreview').hidden = false;
      $('#apPreviewPlaceholder').hidden = true;
      $('#apFormTitle').textContent = '✏️ Edit product — ' + product.name;
      $('#apSubmitBtn').textContent = 'Save Changes';
      $('#apCancelEdit').hidden = false;
      $$('.admin-tab').forEach(function (t) { t.classList.toggle('active', t.dataset.tab === 'add'); });
      $$('.admin-tab-panel').forEach(function (p) { p.classList.toggle('active', p.id === 'tab-add'); });
      $('#tab-add').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    $('#apCancelEdit').addEventListener('click', function () {
      resetProductForm();
    });

    $('#addProductForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var editId = $('#apEditId').value;
      var data = {
        name: $('#apName').value.trim(),
        brand: $('#apBrand').value.trim(),
        category: $('#apCategory').value,
        price: Number($('#apPrice').value),
        oldPrice: $('#apOldPrice').value === '' ? null : Number($('#apOldPrice').value),
        stock: Number($('#apStock').value),
        rating: Number($('#apRating').value) || 4.5,
        description: $('#apDesc').value.trim()
      };
      if (editId) {
        updateCustomProduct(editId, data, pendingPhoto);
        toast('Product updated', 'success');
      } else {
        addCustomProduct(data, pendingPhoto);
        toast('Product added to catalog', 'success');
      }
      resetProductForm();
      $('#apSuccess').hidden = false;
      setTimeout(function () { $('#apSuccess').hidden = true; }, 3000);
      renderManageList();
      renderCategoryTabs();
      renderBrandFilterList();
      renderBrandsSection();
      renderSpotlight();
      renderGrid();
    });

    $('#manageList').addEventListener('click', function (e) {
      var row = e.target.closest('.manage-row');
      if (!row) return;
      var delBtn = e.target.closest('[data-action="delete-product"]');
      var editBtn = e.target.closest('[data-action="edit-product"]');
      if (delBtn) {
        deleteCustomProduct(row.dataset.id);
        renderManageList();
        renderGrid();
        renderBrandsSection();
        renderSpotlight();
        toast('Product removed', 'info');
      } else if (editBtn) {
        var product = getCustomProduct(row.dataset.id);
        if (product) enterEditMode(product);
      }
    });

    $('#ordersList').addEventListener('click', function (e) {
      var btn = e.target.closest('[data-action="view-invoice"]');
      if (!btn) return;
      var row = btn.closest('.order-row');
      var order = window.Tracking ? window.Tracking.getOrderById(row.dataset.orderId) : null;
      if (order) openInvoice(order);
    });

    $('#closeInvoiceModal').addEventListener('click', closeInvoice);
    $('#invoiceCloseBtn').addEventListener('click', closeInvoice);
    $('#invoiceOverlay').addEventListener('click', closeInvoice);
    $('#invoicePrintBtn').addEventListener('click', function () { window.print(); });

    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      closeCart(); closeProductModal(); closeCheckout(); closeInvoice();
    });

    document.addEventListener('en:track', debounce(function () {
      var panel = $('#tab-analytics');
      if (panel && panel.classList.contains('active') && !$('#view-admin').hidden) renderAnalytics();
    }, 400));
  }

  /* ---------------------------------------------------------
     Init
  --------------------------------------------------------- */
  function init() {
    $('#year').textContent = new Date().getFullYear();
    initTheme();

    var statBrands = $('#statBrandsCount');
    if (statBrands) statBrands.dataset.count = BRANDS.length;
    var statProducts = $('#statProductsCount');
    if (statProducts) statProducts.dataset.count = state.products.length;

    renderBrandsSection();
    renderSpotlight();
    renderCategoryTabs();
    renderBrandFilterList();
    renderRatingFilterList();
    updateCartBadge();
    updateWishlistBadge();
    renderCart();
    renderGrid();
    wireEvents();
    wireAuthEvents();
    initHeaderScroll();
    initReveal();
    initCounters();
    handleRoute();

    var waFab = $('#whatsappFab');
    if (waFab) waFab.href = waLink('Hi PhoneSouq Kuwait, I have a question about your products.');

    setTimeout(function () {
      var pre = $('#preloader');
      if (pre) pre.classList.add('hide');
    }, 350);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
