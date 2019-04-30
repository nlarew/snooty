const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const uuidv1 = require('uuid/v1');
const { Stitch, AnonymousCredential } = require('mongodb-stitch-server-sdk');

// where assets and documents are referenced
let NAMESPACE_ASSETS = null;
let DOCUMENTS = null;

// test data properties
const USE_TEST_DATA = process.env.USE_TEST_DATA;
const TEST_DATA_PATH = 'tests/unit/data/site';
const LATEST_TEST_DATA_FILE = '__testDataLatest.json';

// different types of references
const PAGES = [];
const INCLUDE_FILES = [];
const GITHUB_CODE_EXAMPLES = [];
const ASSETS = [];

// in-memory object with key/value = filename/document
let RESOLVED_REF_DOC_MAPPING = {};

// stich client connection
let stitchClient;

const setupStitch = () => {
  return new Promise((resolve, reject) => {
    stitchClient = Stitch.hasAppClient(process.env.STITCH_ID)
      ? Stitch.getAppClient(process.env.STITCH_ID)
      : Stitch.initializeAppClient(process.env.STITCH_ID);
    stitchClient.auth
      .loginWithCredential(new AnonymousCredential())
      .then(user => {
        console.log('logged into stitch');
        resolve();
      })
      .catch(console.error);
  });
};

// env variables for building site along with use in front-end
// https://www.gatsbyjs.org/docs/environment-variables/#defining-environment-variables
const validateEnvVariables = () => {
  // make sure necessary env vars exist
  if (!process.env.NAMESPACE || !process.env.STITCH_ID || !process.env.DOCUMENTS || process.env.GATSBY_PREFIX === undefined) {
    return { 
      error: true, 
      message: 'ERROR with .env.* file: parameters required are GATSBY_PREFIX, DOCUMENTS, NAMESPACE, and STITCH_ID' 
    };
  }
  // make sure formats are correct
  if (process.env.NODE_ENV === 'production' && !process.env.GATSBY_PREFIX.startsWith('/')) {
    return { 
      error: true, 
      message: 'ERROR with .env.* file: GATSBY_PREFIX must be in format /<site>/<user>/<branch>' 
    };
  } 
  if (!process.env.DOCUMENTS.startsWith('/')) {
    return { 
      error: true, 
      message: 'ERROR with .env.* file: DOCUMENTS must be in format /<site>/<user>/<branch>' 
    };
  }
  // create split prefix for use in stitch function
  DOCUMENTS = process.env.DOCUMENTS.substr(1).split('/');
  NAMESPACE_ASSETS = `${process.env.NAMESPACE.split('/')[0]}/assets`;
  return {
    error: false
  };
};

const saveAssetFile = async (name, objData) => {
  return new Promise((resolve, reject) => {
    fs.writeFile(`static/${name}`, objData.data.buffer, 'binary', err => {
      if (err) console.log('ERROR with saving asset', err);
      resolve();
    });
  });
};

exports.sourceNodes = async ({ actions }) => {
  const { createNode } = actions;
  const items = [];

  // setup env variables
  const envResults = validateEnvVariables();

  if (envResults.error) {
    throw Error(envResults.message);
  } 

  // wait to connect to stitch
  await setupStitch();

  // if running with test data
  if (USE_TEST_DATA) {
    // get data from test file
    try {
      const fullpath = path.join(TEST_DATA_PATH, USE_TEST_DATA);
      const fileContent = fs.readFileSync(fullpath, 'utf8');
      RESOLVED_REF_DOC_MAPPING = JSON.parse(fileContent);
      console.log(`*** Using test data from "${fullpath}"`);
    } catch (e) {
      throw Error(`ERROR with test data file: ${e}`);
    }
  } else {
    // start from index document
    const query = { _id: `${DOCUMENTS.join('/')}/index` };
    const documents = await stitchClient.callFunction('fetchDocuments', [process.env.NAMESPACE, query]);

    // set data for index page
    RESOLVED_REF_DOC_MAPPING['index'] = documents && documents.length > 0 ? documents[0] : {};

    // resolve references/urls to documents
    RESOLVED_REF_DOC_MAPPING = await stitchClient.callFunction('resolveReferences', [
      DOCUMENTS,
      process.env.NAMESPACE,
      documents,
      RESOLVED_REF_DOC_MAPPING,
    ]);
  }

  // separate references into correct types, e.g. pages, include files, assets, etc.
  for (const ref of Object.keys(RESOLVED_REF_DOC_MAPPING)) {
    if (ref.includes('includes/')) {
      INCLUDE_FILES.push(ref);
    } else if (ref.includes('https://github.com')) {
      GITHUB_CODE_EXAMPLES.push(ref);
    } else if (ref.includes('#')) {
      ASSETS.push(ref);
    } else if (!ref.includes('curl') && !ref.includes('https://')) {
      PAGES.push(ref);
    }
  }

  // get code examples for all github urls
  for (const url of GITHUB_CODE_EXAMPLES) {
    const githubRawUrl = url.replace('https://github.com', 'https://raw.githubusercontent.com').replace('blob/', '');
    const codeFile = await stitchClient.callFunction('fetchReferenceUrlContent', [githubRawUrl]);
    RESOLVED_REF_DOC_MAPPING[url] = codeFile;
  }

  // create images directory
  for (const asset of ASSETS) {
    const [assetName, assetHash] = asset.split('#');
    const assetQuery = { _id: assetHash };
    const assetDataDocuments = await stitchClient.callFunction('fetchDocuments', [NAMESPACE_ASSETS, assetQuery]);
    if (assetDataDocuments && assetDataDocuments[0]) {
      await saveAssetFile(assetName, assetDataDocuments[0]);
    }
  }

  console.log(11, PAGES);
  console.log(22, INCLUDE_FILES);
  console.log(33, GITHUB_CODE_EXAMPLES);
  console.log(44, ASSETS);
  //console.log(RESOLVED_REF_DOC_MAPPING);

  // whenever we get latest data, always save latest version
  if (!USE_TEST_DATA) {
    const fullpathLatest = path.join(TEST_DATA_PATH, LATEST_TEST_DATA_FILE);
    fs.writeFile(fullpathLatest, JSON.stringify(RESOLVED_REF_DOC_MAPPING), 'utf8', err => {
      if (err) console.log(`ERROR saving test data into "${fullpathLatest}" file`, err);
      console.log(`** Saved test data into "${fullpathLatest}"`);
    });
  }
};

exports.createPages = ({ graphql, actions }) => {
  const { createPage } = actions;

  return new Promise((resolve, reject) => {
    for (const page of PAGES) {
      const template = page === 'index' ? 'index' : 'guide';
      const pageUrl = page === 'index' ? '/' : page;
      if (RESOLVED_REF_DOC_MAPPING[page] && Object.keys(RESOLVED_REF_DOC_MAPPING[page]).length > 0) {
        createPage({
          path: pageUrl,
          component: path.resolve(`./src/templates/${template}.js`),
          context: {
            __refDocMapping: RESOLVED_REF_DOC_MAPPING,
            __stitchID: process.env.STITCH_ID,
          },
        });
      }
    }
    resolve();
  });
};