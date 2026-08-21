/**
 * Guards the privacy rules in analytics-schema.ts.
 *
 * These are the checks that matter if someone later adds a call site: the
 * property allowlist is what stops a name or an email reaching PostHog, and the
 * attribution validator is what stops a hand-edited outreach link doing the
 * same. Run with `npm test`.
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  ALLOWED_PROPS,
  ATTRIBUTION_KEYS,
  CTA_LOCATIONS,
  EVENTS,
  VALID,
  pageGroup,
  parseAttribution,
  sanitize,
} from '../src/lib/analytics-schema.ts'

describe('property allowlist', () => {
  it('drops personal fields even when a call site passes them', () => {
    const out = sanitize({
      cta_location: 'hero',
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      organization: 'Newark Salvation Army',
      school: 'PS 101',
      story_text: 'Once upon a time',
      ip: '203.0.113.4',
      $ip: '203.0.113.4',
      distinct_id: 'ada@example.com',
    })
    assert.deepEqual(out, { cta_location: 'hero' })
  })

  it('has no key that could hold user-generated content', () => {
    // The three *_id keys are deliberate, and all three are opaque: asset_id is
    // a session number, outreach_id and batch_id are random campaign ids the
    // team generates. Anything else ending in _id needs review before it is
    // added here, because ids are the usual way personal data sneaks in.
    const opaqueIds = new Set(['asset_id', 'outreach_id', 'batch_id'])

    for (const key of ALLOWED_PROPS) {
      if (opaqueIds.has(key)) continue
      assert.doesNotMatch(
        key,
        /name|email|phone|school|org|title|text|prompt|query|url|referrer|id$/,
        `${key} looks like it could carry personal or free-form data`
      )
    }
    for (const key of opaqueIds) assert.ok(ALLOWED_PROPS.has(key), key)
  })

  it('drops empty values and caps length', () => {
    assert.deepEqual(sanitize({ cta_location: '', page_group: null, asset_id: undefined }), {})
    assert.equal(sanitize({ asset_id: 'x'.repeat(200) }).asset_id.length, 64)
  })

  it('coerces non-strings rather than passing objects through', () => {
    assert.deepEqual(sanitize({ asset_id: 7 }), { asset_id: '7' })
  })
})

describe('attribution parsing', () => {
  it('reads only the approved campaign fields', () => {
    const out = parseAttribution('?utm_source=newsletter&utm_campaign=sept6&email=ada@example.com&ref=abc')
    assert.deepEqual(out, { utm_source: 'newsletter', utm_campaign: 'sept6' })
  })

  it('rejects a value that smuggles an address or markup', () => {
    for (const bad of ['ada@example.com', '<script>', 'a b', 'x'.repeat(65), '', 'a/b']) {
      assert.deepEqual(parseAttribution(`?outreach_id=${encodeURIComponent(bad)}`), {}, bad)
    }
  })

  it('accepts an opaque outreach id', () => {
    assert.deepEqual(parseAttribution('?outreach_id=k3f9-2ab_1'), { outreach_id: 'k3f9-2ab_1' })
  })

  it('every attribution key is also on the send allowlist', () => {
    for (const key of ATTRIBUTION_KEYS) assert.ok(ALLOWED_PROPS.has(key), key)
  })
})

describe('page groups', () => {
  it('collapses detail routes to a fixed label', () => {
    assert.equal(pageGroup('/'), 'home')
    assert.equal(pageGroup('/stories/'), 'stories')
    assert.equal(pageGroup('/stories/the-lost-kitten/'), 'story_detail')
    assert.equal(pageGroup('/programs/summer-2026/'), 'program_detail')
    assert.equal(pageGroup('/blog/why-we-built-it/'), 'blog_post')
    assert.equal(pageGroup('/curriculum/'), 'curriculum')
  })

  it('never returns a child’s story slug', () => {
    assert.doesNotMatch(pageGroup('/stories/ada-and-the-dragon/'), /ada/)
  })
})

describe('schema', () => {
  it('exposes exactly the six approved events', () => {
    assert.equal(EVENTS.length, 6)
    assert.ok(EVENTS.includes('training_registration_completed'))
  })

  it('constrains cta_location to a closed set', () => {
    for (const location of CTA_LOCATIONS) assert.match(location, VALID)
  })
})
