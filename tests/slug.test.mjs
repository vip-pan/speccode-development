import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  TYPES, validateSlug, validateBranch, branchToStateName, stateNameToBranch,
} from '../lib/slug.mjs';

test('TYPES has the four branch types', () => {
  assert.deepEqual(TYPES, ['feature', 'bugfix', 'refactor', 'chore']);
});

test('validateSlug accepts lowercase alnum and hyphen', () => {
  assert.ok(validateSlug('payment'));
  assert.ok(validateSlug('pay-ment-api'));
  assert.ok(validateSlug('v2'));
});

test('validateSlug rejects illegal chars', () => {
  assert.ok(!validateSlug('Payment'));   // uppercase
  assert.ok(!validateSlug('pay_ment'));  // underscore
  assert.ok(!validateSlug('pay ment'));  // space
  assert.ok(!validateSlug('pay/ment'));  // slash
  assert.ok(!validateSlug(''));          // empty
});

test('validateBranch requires <type>/<slug> shape', () => {
  assert.ok(validateBranch('feature/payment'));
  assert.ok(validateBranch('bugfix/pay-ment'));
  assert.ok(!validateBranch('feature'));            // no slash
  assert.ok(!validateBranch('feature/pay/ment'));   // two slashes
  assert.ok(!validateBranch('wip/payment'));        // bad type
  assert.ok(!validateBranch('feature/Payment'));    // bad slug
});

test('branchToStateName uses double underscore', () => {
  assert.equal(branchToStateName('feature/payment'), 'feature__payment');
  assert.equal(branchToStateName('bugfix/pay-ment'), 'bugfix__pay-ment');
});

test('stateNameToBranch inverts branchToStateName', () => {
  assert.equal(stateNameToBranch('feature__payment'), 'feature/payment');
  assert.equal(stateNameToBranch('bugfix__pay-ment'), 'bugfix/pay-ment');
});
