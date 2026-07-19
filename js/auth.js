/* =========================================================
   PhoneSouq Kuwait — Accounts & Security
   Client-side customer accounts with hashed passwords and
   brute-force lockout protection.

   IMPORTANT — read this before going live:
   This runs entirely in the visitor's browser (localStorage),
   the same way the rest of this demo's data layer works. The
   password hashing below (SHA-256 via the Web Crypto API) is
   meant to avoid storing plain-text passwords in localStorage,
   NOT to serve as production-grade authentication. A real
   deployment needs: a real backend, passwords hashed server
   side with bcrypt/argon2 + a per-user salt, HTTPS everywhere,
   and server-side rate limiting (the lockout here is easily
   bypassed by clearing localStorage). Treat this as a working
   prototype of the UX, not a security boundary.
========================================================= */
(function (global) {
  'use strict';

  var CUSTOMERS_KEY = 'en_customers';
  var SESSION_KEY = 'en_customer_session';
  var ATTEMPTS_KEY = 'en_login_attempts';
  var SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days "remember me"
  var MAX_ATTEMPTS = 5;
  var LOCK_MS = 60 * 1000; // 60 seconds

  function loadJSON(key, fallback) {
    try { var v = JSON.parse(localStorage.getItem(key)); return v == null ? fallback : v; } catch (e) { return fallback; }
  }
  function saveJSON(key, val) { localStorage.setItem(key, JSON.stringify(val)); }

  function uid() { return 'cust_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

  // ---- password hashing (SHA-256, with a fallback if SubtleCrypto is unavailable) ----
  function fallbackHash(str) {
    var h1 = 0, h2 = 0;
    for (var i = 0; i < str.length; i++) {
      var c = str.charCodeAt(i);
      h1 = (h1 * 31 + c) | 0;
      h2 = (h2 * 131 + c) | 0;
    }
    return 'fb_' + (h1 >>> 0).toString(16) + (h2 >>> 0).toString(16);
  }

  function hashPassword(password, email) {
    var salted = 'phonesouq-kw::' + String(email || '').toLowerCase() + '::' + password;
    if (global.crypto && global.crypto.subtle && global.TextEncoder) {
      var data = new TextEncoder().encode(salted);
      return global.crypto.subtle.digest('SHA-256', data).then(function (buf) {
        var bytes = new Uint8Array(buf);
        var hex = '';
        for (var i = 0; i < bytes.length; i++) hex += bytes[i].toString(16).padStart(2, '0');
        return hex;
      }).catch(function () { return fallbackHash(salted); });
    }
    return Promise.resolve(fallbackHash(salted));
  }

  function passwordStrength(pw) {
    pw = pw || '';
    var score = 0;
    if (pw.length >= 8) score++;
    if (pw.length >= 12) score++;
    if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
    if (/\d/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;
    if (pw.length < 8) return { score: 0, label: 'Too short (min 8 characters)' };
    if (score <= 2) return { score: 1, label: 'Weak' };
    if (score <= 3) return { score: 2, label: 'Medium' };
    return { score: 3, label: 'Strong' };
  }

  // ---- brute-force lockout (shared by customer + admin login) ----
  function checkLockout(scope, key) {
    var all = loadJSON(ATTEMPTS_KEY, {});
    var rec = all[scope + ':' + key.toLowerCase()];
    if (!rec) return { locked: false };
    if (rec.lockUntil && rec.lockUntil > Date.now()) {
      return { locked: true, remainingMs: rec.lockUntil - Date.now() };
    }
    return { locked: false };
  }

  function recordAttempt(scope, key, success) {
    var all = loadJSON(ATTEMPTS_KEY, {});
    var k = scope + ':' + key.toLowerCase();
    if (success) { delete all[k]; saveJSON(ATTEMPTS_KEY, all); return; }
    var rec = all[k] || { count: 0 };
    rec.count = (rec.count || 0) + 1;
    if (rec.count >= MAX_ATTEMPTS) {
      rec.lockUntil = Date.now() + LOCK_MS;
      rec.count = 0;
    }
    all[k] = rec;
    saveJSON(ATTEMPTS_KEY, all);
  }

  // ---- customers ----
  function getCustomers() { return loadJSON(CUSTOMERS_KEY, []); }
  function saveCustomers(list) { saveJSON(CUSTOMERS_KEY, list); }
  function findByEmail(email) {
    email = String(email || '').toLowerCase();
    return getCustomers().find(function (c) { return c.email.toLowerCase() === email; }) || null;
  }

  function signup(data) {
    var email = String(data.email || '').trim().toLowerCase();
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) return Promise.resolve({ ok: false, error: 'Enter a valid email address.' });
    if (!data.name || !data.name.trim()) return Promise.resolve({ ok: false, error: 'Enter your name.' });
    if (findByEmail(email)) return Promise.resolve({ ok: false, error: 'An account with this email already exists.' });
    var strength = passwordStrength(data.password);
    if (strength.score === 0) return Promise.resolve({ ok: false, error: 'Password must be at least 8 characters.' });
    if (data.password !== data.confirmPassword) return Promise.resolve({ ok: false, error: 'Passwords do not match.' });

    return hashPassword(data.password, email).then(function (hash) {
      var customer = {
        id: uid(), name: data.name.trim(), email: email,
        phone: (data.phone || '').trim(), passwordHash: hash, createdAt: Date.now()
      };
      var list = getCustomers();
      list.push(customer);
      saveCustomers(list);
      startSession(customer.id);
      return { ok: true, customer: publicCustomer(customer) };
    });
  }

  function login(email, password) {
    email = String(email || '').trim().toLowerCase();
    var lock = checkLockout('customer', email);
    if (lock.locked) {
      return Promise.resolve({ ok: false, error: 'Too many attempts. Try again in ' + Math.ceil(lock.remainingMs / 1000) + 's.', locked: true });
    }
    var customer = findByEmail(email);
    if (!customer) {
      recordAttempt('customer', email, false);
      return Promise.resolve({ ok: false, error: 'Incorrect email or password.' });
    }
    return hashPassword(password, email).then(function (hash) {
      if (hash !== customer.passwordHash) {
        recordAttempt('customer', email, false);
        return { ok: false, error: 'Incorrect email or password.' };
      }
      recordAttempt('customer', email, true);
      startSession(customer.id);
      return { ok: true, customer: publicCustomer(customer) };
    });
  }

  function publicCustomer(c) { return { id: c.id, name: c.name, email: c.email, phone: c.phone, createdAt: c.createdAt }; }

  function startSession(customerId) {
    saveJSON(SESSION_KEY, { id: customerId, expiresAt: Date.now() + SESSION_TTL_MS });
  }
  function logout() { localStorage.removeItem(SESSION_KEY); }

  function currentCustomer() {
    var session = loadJSON(SESSION_KEY, null);
    if (!session || !session.id) return null;
    if (session.expiresAt && session.expiresAt < Date.now()) { logout(); return null; }
    var customer = getCustomers().find(function (c) { return c.id === session.id; });
    return customer ? publicCustomer(customer) : null;
  }

  function updateProfile(id, data) {
    var list = getCustomers();
    var c = list.find(function (x) { return x.id === id; });
    if (!c) return { ok: false, error: 'Account not found.' };
    if (data.name && data.name.trim()) c.name = data.name.trim();
    if (typeof data.phone === 'string') c.phone = data.phone.trim();
    saveCustomers(list);
    return { ok: true, customer: publicCustomer(c) };
  }

  function changePassword(id, currentPassword, newPassword) {
    var list = getCustomers();
    var c = list.find(function (x) { return x.id === id; });
    if (!c) return Promise.resolve({ ok: false, error: 'Account not found.' });
    return hashPassword(currentPassword, c.email).then(function (hash) {
      if (hash !== c.passwordHash) return { ok: false, error: 'Current password is incorrect.' };
      var strength = passwordStrength(newPassword);
      if (strength.score === 0) return { ok: false, error: 'New password must be at least 8 characters.' };
      return hashPassword(newPassword, c.email).then(function (newHash) {
        c.passwordHash = newHash;
        saveCustomers(list);
        return { ok: true };
      });
    });
  }

  global.Auth = {
    signup: signup,
    login: login,
    logout: logout,
    currentCustomer: currentCustomer,
    updateProfile: updateProfile,
    changePassword: changePassword,
    passwordStrength: passwordStrength,
    checkAdminLockout: function (username) { return checkLockout('admin', username); },
    recordAdminAttempt: function (username, success) { return recordAttempt('admin', username, success); },
    checkCustomerLockout: function (email) { return checkLockout('customer', email); }
  };

})(window);
