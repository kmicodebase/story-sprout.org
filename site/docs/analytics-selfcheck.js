/* Paste into the browser console on https://story-sprout.org/ and press Enter.
   Reports why analytics is or is not running for YOUR visit. */
(async () => {
  const r = (label, ok, note) =>
    console.log(`%c${ok ? 'OK  ' : 'STOP'}%c ${label}${note ? ' — ' + note : ''}`,
      `color:#fff;background:${ok ? '#4f9462' : '#c0392b'};padding:1px 5px;border-radius:3px`, '')

  r('on the instrumented site', location.hostname === 'story-sprout.org',
    location.hostname === 'story-sprout.org' ? '' : `you are on ${location.hostname}; only story-sprout.org is instrumented`)

  const script = document.querySelector('script[src*="Analytics.astro"]')
  r('analytics code present in the page', !!script, script ? '' : 'the deploy did not include it')

  const gpc = navigator.globalPrivacyControl === true
  const dnt = navigator.doNotTrack === '1'
  r('not opted out', !gpc && !dnt,
    gpc ? 'your browser sends Global Privacy Control, so the site deliberately sends nothing'
        : dnt ? 'your browser sends Do Not Track, so the site deliberately sends nothing' : '')

  let reachable = false
  try {
    await fetch('https://us.i.posthog.com/e/', { method: 'POST', mode: 'no-cors', body: '{}' })
    reachable = true
  } catch { /* blocked */ }
  r('PostHog reachable from this browser', reachable,
    reachable ? '' : 'blocked by an ad blocker, extension, or network policy — this is the usual cause')

  console.log('\nNow open DevTools → Network, filter "posthog", and reload.'
    + '\nA POST to us.i.posthog.com/e/ returning 200 means your visit was counted.')
})()
