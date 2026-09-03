import React, { useEffect, useRef, useState } from "react";

const SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY;

let scriptLoaded = false;
const pendingCallbacks = [];

function loadRecaptchaScript() {
  return new Promise((resolve) => {
    if (window.grecaptcha) {
      resolve();
      return;
    }
    if (scriptLoaded) {
      pendingCallbacks.push(resolve);
      return;
    }
    scriptLoaded = true;
    pendingCallbacks.push(resolve);
    window.onRecaptchaLoad = () => {
      const cbs = pendingCallbacks.splice(0);
      cbs.forEach((cb) => cb());
    };
    const script = document.createElement("script");
    script.src = "https://www.google.com/recaptcha/api.js?onload=onRecaptchaLoad&render=explicit";
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);
  });
}

export const Recaptcha = ({ onChange, onExpire }) => {
  const containerRef = useRef(null);
  const widgetIdRef = useRef(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;

    if (!SITE_KEY) {
      setReady(true);
      return;
    }

    loadRecaptchaScript().then(() => {
      if (!mounted || !containerRef.current) return;
      const callback = (token) => onChange?.(token);
      const id = window.grecaptcha.render(containerRef.current, {
        sitekey: SITE_KEY,
        callback,
        "expired-callback": () => onExpire?.(),
      });
      widgetIdRef.current = id;
      setReady(true);
    });

    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!SITE_KEY) {
    return null;
  }

  return <div ref={containerRef} data-ready={ready} />;
};