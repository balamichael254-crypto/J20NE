/*
 * Moonpie - Android wrapper.
 *
 * What this buys that the PWA cannot, on its own:
 *   - Real screenshot/screen-recording blocking (FLAG_SECURE via
 *     expo-screen-capture). This is the one thing no website, on any phone,
 *     can do - the browser has no hook into the OS's capture pipeline, and
 *     nothing short of a native Android window flag can refuse to be
 *     captured. That flag only exists for a native app, which is the entire
 *     reason this wrapper exists.
 *   - Real native push (below), which a WebView cannot receive on its own -
 *     Android WebViews don't run Service Worker push the way Chrome does, so
 *     the web app's own Web Push subscription silently never fires in here.
 *   - A real app icon, a real "app" in the app switcher, and (later) a
 *     floating overlay for Poo - none of which a browser tab can offer.
 *
 * What this deliberately does NOT change: the app itself is still the same
 * web app at MOONPIE_URL below, loaded in a WebView. Every feature - the
 * vault, Poo, the whole UI - keeps working exactly as it does in the
 * browser, because it IS the browser, just inside a native shell that
 * Android treats differently.
 *
 * ---- Native push, and why it needs a bridge --------------------------
 * The web app already has a push pipeline (push.js + api/push-*.js) built
 * for Web Push, which works fine in real mobile Chrome but not inside this
 * WebView. Rather than build a second, parallel push system, this wrapper
 * gets a native Expo push token and HANDS IT TO THE SAME WEB CODE: once the
 * page loads, `injectJavaScript` sets `window.__MOONPIE_NATIVE_PUSH__` to
 * `{ token }` and fires a `moonpie-native-push` event. push.js checks for
 * that global first and, if present, subscribes with the native token
 * instead of trying (and failing) to use the browser's PushManager. The
 * server (api/push-subscribe.js / api/push-send.js) accepts either shape
 * and sends through Expo's push service for native tokens, web-push for
 * browser ones.
 *
 * iOS gets none of the screenshot protection - Apple has never exposed a way
 * to block a screenshot, for native apps or otherwise, only a
 * screen-RECORDING notification after the fact. That's a platform ceiling,
 * not something this wrapper failed to do. Native push works on both
 * platforms once built with EAS (iOS needs its own push credentials, set up
 * the first time `eas build` runs for iOS).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  BackHandler,
  Platform,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  View,
} from "react-native";
import { WebView } from "react-native-webview";
import * as ScreenCapture from "expo-screen-capture";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";

const MOONPIE_URL =
  Constants.expoConfig?.extra?.moonpieUrl ||
  "https://moonpie-wine.vercel.app/miss-you-app/";

// Notifications arriving while the app is open should still show a banner -
// the default behaviour suppresses them, which would make a "nudge" silently
// do nothing while she's already looking at the app.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

async function getExpoPushToken() {
  if (!Device.isDevice) return null;   // push tokens don't exist on a simulator
  const existing = await Notifications.getPermissionsAsync();
  let status = existing.status;
  if (status !== "granted") {
    status = (await Notifications.requestPermissionsAsync()).status;
  }
  if (status !== "granted") return null;

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("moonpie-nudges", {
      name: "Moonpie nudges",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 200, 100, 200],
      lightColor: "#f56da8",
    });
  }

  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  const { data: token } = await Notifications.getExpoPushTokenAsync(
    projectId ? { projectId } : undefined
  );
  return token;
}

export default function App() {
  const webviewRef = useRef(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const pushTokenRef = useRef(null);

  ScreenCapture.usePreventScreenCapture("moonpie-app");

  useEffect(() => {
    getExpoPushToken().then(token => { pushTokenRef.current = token; });
  }, []);

  // Handing the token to a page that's already loaded (or hasn't loaded yet)
  // are two different races - this covers both by re-sending on every load.
  const injectPushToken = useCallback(() => {
    const token = pushTokenRef.current;
    if (!token || !webviewRef.current) return;
    const script = `
      window.__MOONPIE_NATIVE_PUSH__ = ${JSON.stringify({ token })};
      window.dispatchEvent(new Event("moonpie-native-push"));
      true;
    `;
    webviewRef.current.injectJavaScript(script);
  }, []);

  const handleBack = useCallback(() => {
    if (canGoBack && webviewRef.current) {
      webviewRef.current.goBack();
      return true;
    }
    return false;
  }, [canGoBack]);

  useEffect(() => {
    if (Platform.OS !== "android") return;
    const sub = BackHandler.addEventListener("hardwareBackPress", handleBack);
    return () => sub.remove();
  }, [handleBack]);

  // Tapping a delivered notification should bring the app to the care
  // screen, same as the web app's own notificationclick handler does in the
  // browser - this is the native-app equivalent of that.
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener(() => {
      webviewRef.current?.injectJavaScript(
        `window.location.hash = "care"; true;`
      );
    });
    return () => sub.remove();
  }, []);

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#e9dffa" />
      <View style={styles.webviewWrap}>
        <WebView
          ref={webviewRef}
          source={{ uri: MOONPIE_URL }}
          onNavigationStateChange={nav => setCanGoBack(nav.canGoBack)}
          onLoadEnd={injectPushToken}
          style={styles.webview}
          allowsBackForwardNavigationGestures
          decelerationRate="normal"
          startInLoadingState
          domStorageEnabled
          javaScriptEnabled
          mediaPlaybackRequiresUserAction={false}
          allowsInlineMediaPlayback
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#e9dffa" },
  webviewWrap: { flex: 1 },
  webview: { flex: 1, backgroundColor: "#e9dffa" },
});
