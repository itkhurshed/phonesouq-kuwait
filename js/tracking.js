/* =========================================================
   PhoneSouq Kuwait — Tracking System
   Client-side analytics events + order tracking.
   NOTE: this is a self-contained demo tracking system that
   stores events/orders in localStorage on the visitor's own
   browser. It is NOT connected to a real analytics backend
   (e.g. GA4/Segment) or a real shipping carrier — wiring it
   to one is a drop-in swap of the storage functions below.
========================================================= */
(function (global) {
  'use strict';

  var EVENTS_KEY = 'en_events';
  var ORDERS_KEY = 'en_orders';
  var MAX_EVENTS = 500;

  // ---- storage helpers -------------------------------------------------
  function safeParse(json, fallback) {
    try {
      var v = JSON.parse(json);
      return v === null || v === undefined ? fallback : v;
    } catch (e) {
      return fallback;
    }
  }

  function loadEvents() {
    return safeParse(localStorage.getItem(EVENTS_KEY), []);
  }
  function saveEvents(list) {
    // keep storage bounded
    if (list.length > MAX_EVENTS) list = list.slice(list.length - MAX_EVENTS);
    localStorage.setItem(EVENTS_KEY, JSON.stringify(list));
  }
  function loadOrders() {
    return safeParse(localStorage.getItem(ORDERS_KEY), []);
  }
  function saveOrders(list) {
    localStorage.setItem(ORDERS_KEY, JSON.stringify(list));
  }

  // ---- event tracking ----------------------------------------------------
  function trackEvent(name, data) {
    try {
      var events = loadEvents();
      events.push({
        name: name,
        data: data || {},
        ts: Date.now()
      });
      saveEvents(events);
      document.dispatchEvent(new CustomEvent('en:track', { detail: { name: name, data: data } }));
    } catch (e) {
      // tracking must never break the storefront
      console.warn('[tracking] failed to record event', name, e);
    }
  }

  function getEvents() {
    return loadEvents();
  }

  function clearEvents() {
    saveEvents([]);
  }

  function countEvents(name) {
    return loadEvents().filter(function (e) { return e.name === name; }).length;
  }

  function sumEventValue(name, field) {
    return loadEvents()
      .filter(function (e) { return e.name === name; })
      .reduce(function (sum, e) { return sum + (Number(e.data && e.data[field]) || 0); }, 0);
  }

  // ---- order tracking ----------------------------------------------------
  // Simulated fulfillment timeline. Offsets are in *seconds* after order
  // creation so the whole journey (Confirmed -> Delivered) completes within
  // about a minute — handy for demoing/testing the live status page.
  var STATUS_STEPS = [
    { key: 'confirmed', label: 'Order Confirmed', icon: '✓', offset: 0 },
    { key: 'processing', label: 'Processing', icon: '📦', offset: 12 },
    { key: 'shipped', label: 'Shipped', icon: '🚚', offset: 28 },
    { key: 'out_for_delivery', label: 'Out for Delivery', icon: '🛵', offset: 45 },
    { key: 'delivered', label: 'Delivered', icon: '🏠', offset: 60 }
  ];

  function genOrderId() {
    var n = Math.floor(10000 + Math.random() * 89999);
    return 'EN-' + n;
  }

  function createOrder(order) {
    var orders = loadOrders();
    var id = genOrderId();
    while (orders.some(function (o) { return o.id === id; })) id = genOrderId();

    var record = Object.assign({
      id: id,
      createdAt: Date.now()
    }, order);

    orders.unshift(record);
    saveOrders(orders);
    return record;
  }

  function getOrders() {
    return loadOrders();
  }

  function findOrder(id, email) {
    id = (id || '').trim().toUpperCase();
    email = (email || '').trim().toLowerCase();
    return loadOrders().find(function (o) {
      return o.id.toUpperCase() === id && (o.email || '').toLowerCase() === email;
    }) || null;
  }

  function getOrderById(id) {
    id = (id || '').trim().toUpperCase();
    return loadOrders().find(function (o) { return o.id.toUpperCase() === id; }) || null;
  }

  // Returns the current status of an order based on elapsed time since
  // creation, plus full step metadata for rendering a progress timeline.
  function computeOrderStatus(order) {
    var elapsedSec = (Date.now() - order.createdAt) / 1000;
    var currentIndex = 0;
    for (var i = 0; i < STATUS_STEPS.length; i++) {
      if (elapsedSec >= STATUS_STEPS[i].offset) currentIndex = i;
    }
    var steps = STATUS_STEPS.map(function (s, i) {
      return {
        key: s.key,
        label: s.label,
        icon: s.icon,
        done: i < currentIndex,
        active: i === currentIndex,
        time: new Date(order.createdAt + s.offset * 1000)
      };
    });
    return {
      currentIndex: currentIndex,
      currentStep: STATUS_STEPS[currentIndex],
      steps: steps,
      isFinal: currentIndex === STATUS_STEPS.length - 1
    };
  }

  global.Tracking = {
    trackEvent: trackEvent,
    getEvents: getEvents,
    clearEvents: clearEvents,
    countEvents: countEvents,
    sumEventValue: sumEventValue,
    createOrder: createOrder,
    getOrders: getOrders,
    findOrder: findOrder,
    getOrderById: getOrderById,
    computeOrderStatus: computeOrderStatus,
    STATUS_STEPS: STATUS_STEPS
  };

  // Fire a page_view on every load.
  trackEvent('page_view', { path: global.location.hash || '/', ref: document.referrer || 'direct' });

})(window);
