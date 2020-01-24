import React from 'react';
import styled from '@emotion/styled';
import { useFeedbackState } from './context';
import usePageSize from '../../hooks/usePageSize';

const Container = styled.div`
  position: fixed;
  top: 256px;
  right: 35px;
  transform: rotate(-90deg);
  transform-origin: top right;
  user-select: none;

  padding: 8px;
  border: 1px solid black;
  border-top-left-radius: 4px;
  border-top-right-radius: 4px;
`;
export default function FeedbackTab(props) {
  const { feedback, initializeFeedback } = useFeedbackState();
  const { isTabletOrMobile } = usePageSize();
  const shouldShowFeedbackTab = !feedback && !isTabletOrMobile;
  return shouldShowFeedbackTab && <Container onClick={() => initializeFeedback()}>Give Feedback</Container>;
}