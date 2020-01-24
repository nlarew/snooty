import React from 'react';
import { createNewFeedback, updateFeedback, submitFeedback, abandonFeedback, useStitchUser } from './stitch';
import { getSegmentUserId } from './segment';
import * as R from 'ramda';

const FeedbackContext = React.createContext();

export function FeedbackProvider({ page, ...props }) {
  const [feedback, setFeedback] = React.useState(null);
  const [isSupportRequest, setIsSupportRequest] = React.useState(false);
  console.log('feedback', feedback);
  const [view, setView] = React.useState('waiting');
  const user = useStitchUser();

  async function initializeFeedback(initialView = 'rating') {
    const segment = getSegmentUserId();
    const newFeedback = await createNewFeedback({
      page: {
        title: page.title,
        slug: page.slug,
        url: page.url,
        docs_property: page.docs_property,
        docs_version: null,
      },
      user: {
        stitch_id: user.id,
        segment_id: segment.id,
        isAnonymous: segment.isAnonymous,
      },
    });
    setFeedback(newFeedback);
    setView(initialView);
    return newFeedback;
  }

  async function setRating(ratingValue) {
    let feedback_id;
    if (!feedback) {
      feedback_id = (await initializeFeedback('waiting'))._id;
    }
    if (feedback && feedback.rating) return;
    // Must be in range [1-5]
    if (typeof ratingValue !== 'number') {
      throw new Error('Rating value must be a number.');
    }
    if (ratingValue < 1 || ratingValue > 5) {
      throw new Error('Rating value must be between 1 and 5, inclusive.');
    }
    const updatedFeedback = await updateFeedback({
      feedback_id: feedback ? feedback._id : feedback_id,
      rating: ratingValue,
    });
    setFeedback(updatedFeedback);
    setView('qualifiers');
  }

  async function setQualifier(id, value) {
    if (!feedback) return;
    if (typeof id !== 'string') {
      throw new Error('id must be a string Qualifier ID.');
    }
    if (typeof value !== 'boolean') {
      throw new Error('value must be a boolean.');
    }
    const updatedQualifiers = R.adjust(
      feedback.qualifiers.findIndex(R.propEq('id', id)), // Find the qualifier by id
      q => ({ ...q, value }), // Update the value
      feedback.qualifiers // Adjust this array of qualifiers
    );
    const updatedFeedback = await updateFeedback({
      feedback_id: feedback._id,
      qualifiers: updatedQualifiers,
    });
    const selectedSupportQualifier = updatedFeedback.qualifiers.find(q => q.id === 'support' && q.value === true);
    setIsSupportRequest(Boolean(selectedSupportQualifier));
    setFeedback(updatedFeedback);
  }

  function submitQualifiers() {
    setView('comment');
  }

  async function submitComment({ comment = '', email = '' }) {
    if (!feedback) return;
    await updateFeedback({
      feedback_id: feedback._id,
      comment,
      user: { email },
    });
    const submittedFeedback = await submitFeedback({ feedback_id: feedback._id });
    if (isSupportRequest) {
      setFeedback(submittedFeedback);
      setView('support');
    } else {
      setView('submitted');
      setFeedback(null);
    }
    return submittedFeedback;
  }

  async function submitSupport() {
    if (!feedback) return;
    setView('submitted');
    setFeedback(null);
  }

  async function abandon() {
    if (feedback) {
      await abandonFeedback({ feedback_id: feedback._id });
    }
    setView('waiting');
    setFeedback(null);
  }

  const value = {
    feedback,
    view,
    isSupportRequest,
    initializeFeedback,
    setRating,
    setQualifier,
    submitQualifiers,
    submitComment,
    submitSupport,
    abandon,
  };
  return <FeedbackContext.Provider value={value}>{props.children}</FeedbackContext.Provider>;
}

export function useFeedbackState() {
  const feedback = React.useContext(FeedbackContext);
  if (!feedback && feedback !== null) {
    throw new Error('You must nest useFeedbackState() inside of a FeedbackProvider.');
  }
  return feedback;
}