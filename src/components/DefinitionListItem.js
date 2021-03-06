import React from 'react';
import PropTypes from 'prop-types';
import ComponentFactory from './ComponentFactory';
import { findKeyValuePair } from '../utils/find-key-value-pair';

const DefinitionListItem = ({ nodeData: { children, term }, ...rest }) => {
  const termProps = {};
  const targetIdentifier = findKeyValuePair(term, 'type', 'inline_target');
  if (targetIdentifier) {
    termProps.id = targetIdentifier.html_id;
  }

  return (
    <>
      <dt {...termProps}>
        {term.map((child, index) => (
          <ComponentFactory nodeData={child} key={`dt-${index}`} />
        ))}
      </dt>
      <dd>
        {children.map((child, index) => (
          <ComponentFactory {...rest} nodeData={child} key={`dd-${index}`} parentNode="definitionListItem" />
        ))}
      </dd>
    </>
  );
};

DefinitionListItem.propTypes = {
  nodeData: PropTypes.shape({
    children: PropTypes.array.isRequired,
    term: PropTypes.arrayOf(PropTypes.object).isRequired,
  }).isRequired,
};

export default DefinitionListItem;
