import Promise from 'promise';

function action(name, ...outcomes) {
  return {
    name,
    forEach : (cb) => outcomes.forEach(( outcome ) => cb({name, outcome:outcome}))
  }
}

/**
 * Tests the correctness of a pattern, given a set of actions (defined via the `action` function),
 * and a list of valid call sequences. This will run the given pattern with every permutation of
 * outcomes for the defined actions, and ensure that the call sequence the pattern applies to the
 * actions is one listed as valid.
 */
function test_correctness(actions, valid_sequences, pattern_to_test) {
  let outcome = Promise.resolve();
  let failures = [];

  // Given the various outcomes of each of our actions, generate every possible 
  // permutation, assuming each action always does the same thing within one trial.
  all_permutations(actions, (permutation) => {
    // And now we're going to try this permutation against the pattern we were given.
    // What we're looking for is ensuring the pattern never invokes the actions in 
    // any other sequence than the valid ones we've listed.

    // This tracks the sequence of calls made by the pattern
    let sequence = [];
    
    // Convert the current permutation to arguments for the pattern, where each one
    // tracks if the action was invoked by adding it to `sequence`.
    let args = permutation.map( (action) => () => {
      sequence.push(action);
      return action.outcome();
    })

    // Give it a spin!
    let result = null;
    try {
      result = pattern_to_test.apply(null, args);
    } catch(e) {}

    // Validate the sequence
    outcome = outcome
      .then(wait_for(result))
      .then(() => {
        if(!is_valid_sequence(sequence, valid_sequences)) {
          failures.push(
            "Pattern failed validation\n" +
            "  Scenario: " + describe_permutation(permutation) + "\n" +
            "  Sequence: " + sequence.map((s)=>s.name).join(", "));
        }
      });
  });

  return outcome.then(() => {
    if(failures.length > 0) {
      return {passed:false, description:failures.join("\n")};
    } else {
      return {passed:true};
    }
  }).catch( (e) => {
    console.log(e);
    return e;
  });
}

function wait_for(result) {
  // If the pattern provided returned a promise, we need to wait for that
  // promise to resolve or reject. We don't care which it is - but we don't 
  // want it to fail our promise chain if it rejects, so we wrap it like this.
  return new Promise((resolve) => {
    Promise.resolve(result).then(resolve).catch(resolve);
  });
}

function all_permutations( args, callback ) {
  if( args.length == 0 ) {
    callback([]);
  } else {
    let permutations = args[0],
        rest = args.slice(1);
    permutations.forEach( (permutation) =>
      all_permutations(rest, (rest_permutation) => 
        callback([permutation].concat(rest_permutation))
      )
    );
  }
}

function is_valid_sequence( sequence, valid_sequences ) {
  let is_valid = false;
  valid_sequences.forEach( (valid_sequence) => {
    if(sequence_fits_pattern( sequence, valid_sequence )) {
      is_valid = true;
    }
  });
  return is_valid;
}

function sequence_fits_pattern(sequence, valid_sequence) {
  if(sequence.length !== valid_sequence.length) {
    return false;
  }

  for(let i=0;i<sequence.length;i++) {
    let action_taken = sequence[i],
        valid_action = valid_sequence[i];

    if(action_taken.name !== valid_action[0].name) {
      return false;
    }

    if(!action_fits_pattern(action_taken, valid_action)) {
      return false;
    }
  }

  return true;
}

function action_fits_pattern(action_taken, valid_action) {
  if(valid_action.length == 1) {
    // The valid sequence does not specify any constraints on
    // which outcomes it is applicable to, meaning we accept any
    // outcome.
    return true;
  }

  for(let outcome_idx=1; outcome_idx<valid_action.length; outcome_idx++) {
    let valid_outcome = valid_action[outcome_idx];
    if(valid_outcome === action_taken.outcome) {
      return true;
    }
  }
  return false;
}

function describe_permutation(permutation) {
  return permutation.map( (p) => p.name + " -> " + p.outcome.name).join("\n            ");
}

export default {test_correctness, action};