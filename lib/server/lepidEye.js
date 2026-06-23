import { createRequire } from "module";

const require = createRequire(import.meta.url);
const store = require("../../server/lepidEye/store");

export const initLepidEyeDatabase = store.initLepidEyeDatabase;
export const resolveLepidEyeAccess = store.resolveLepidEyeAccess;
export const verifyLepidEyeCreatorToken = store.verifyLepidEyeCreatorToken;
export const getLepidEyeBootstrap = store.getLepidEyeBootstrap;
export const addLepidEyeRecord = store.addLepidEyeRecord;
export const mutateLepidEyeRecord = store.mutateLepidEyeRecord;
