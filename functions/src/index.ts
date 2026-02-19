import {setGlobalOptions} from "firebase-functions/v2";

setGlobalOptions({
  maxInstances: 10,
  region: "us-central1",
});

export {analyzeDocument} from "./analyze";
export {uploadDocument} from "./upload";
export {getReports} from "./reports";