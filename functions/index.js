/**
 * functions/index.js
 * Version: 3.1.0 (Lint Compliant)
 * This is the definitive, secure backend API for the Command Board application,
 * now with tiered licensing, session management, and full lint compliance.
 */

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const {onSchedule} = require("firebase-functions/v2/scheduler");

admin.initializeApp();
const db = admin.firestore();

// ===================================================================
//
//  SECURITY AND AUTHORIZATION
//
// ===================================================================

/**
 * Verifies the Firebase Auth ID token and returns an authorization context.
 * @param {object} req The Express request object.
 * @return {Promise<object>} With {uid, customerId, planLevel}.
 * @throws {Error} If authentication fails.
 */
async function getAuthContextFromIdToken(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new functions.https.HttpsError(
        "unauthenticated",
        "No authentication token was provided.",
    );
  }
  const idToken = authHeader.split("Bearer ")[1];

  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const uid = decodedToken.uid;
    const userRef = db.collection("users").doc(uid);
    const userDoc = await userRef.get();
    if (!userDoc.exists) {
      const errorMsg = "Authenticated user not found in the database.";
      throw new functions.https.HttpsError("not-found", errorMsg);
    }
    const userData = userDoc.data();
    if (userData.status !== "Active") {
      throw new functions.https.HttpsError(
          "permission-denied",
          "This user account is not active.",
      );
    }
    if (!userData.customerId) {
      const errorMsg = "Config error: Customer ID missing for this user.";
      throw new functions.https.HttpsError("internal", errorMsg);
    }
    return {
      uid: uid,
      customerId: userData.customerId,
      planLevel: userData.planLevel || "Basic",
      name: userData.name || "Unknown User",
    };
  } catch (error) {
    console.error("Error while verifying ID token:", error);
    const errorMsg = "The provided auth token is invalid or expired.";
    throw new functions.https.HttpsError("unauthenticated", errorMsg);
  }
}

// ===================================================================
//
//  MAIN API ROUTER
//
// ===================================================================

exports.api = functions.https.onRequest(async (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }

  const action = req.body.action || req.query.action;
  const params = req.method === "POST" ? req.body : req.query;

  try {
    const authContext = await getAuthContextFromIdToken(req);
    const customerId = authContext.customerId;
    const logMsg =
      `Request authorized for user UID: ${authContext.uid} ` +
      `on customerId: ${customerId}`;
    console.log(logMsg);

    let result;
    // The main API switch, now handling new session actions
    switch (action) {
      // --- NEW SESSION MANAGEMENT ACTIONS ---
      case "takeIncidentCommand":
        result = await takeIncidentCommand(params, authContext);
        break;
      case "reestablishCommand":
        result = await reestablishCommand(params, authContext);
        break;
      case "createSession":
        result = await createSession(params, authContext);
        break;
      case "checkSessionStatus":
        result = await checkSessionStatus(params, authContext);
        break;
      case "sessionHeartbeat":
        result = await sessionHeartbeat(params, authContext);
        break;
      case "endSession":
        result = await endSession(params, authContext);
        break;

      // --- EXISTING ACTIONS (alphabetized for clarity) ---
      case "addCommonGroup":
        result = await addCommonGroup(params, customerId);
        break;
      case "addDepartment":
        result = await addDepartment(params, customerId);
        break;
      case "addTemplate":
        result = await addTemplate(params, customerId);
        break;
      case "addUnitToMaster":
        result = await addUnitToMaster(params, authContext);
        break;
      case "addUnitType":
        result = await addUnitType(params, customerId);
        break;
      case "adminGetAllUsers":
        result = await getAllUsers(params, authContext);
        break;
      case "adminRevokeUserSessions":
        result = await revokeUserSessions(params, authContext);
        break;
      case "adminSetNewPassword":
        result = await setNewPasswordForUser(params, authContext);
        break;
      case "applyTemplateToIncident":
        result = await applyTemplateToIncident(params, customerId);
        break;
      case "assignUnitsToGroup":
        result = await assignUnitsToGroup(params, customerId);
        break;
      case "clearGroupParent":
        result = await clearGroupParent(params, customerId);
        break;
      case "clearGroupSupervisor":
        result = await clearGroupSupervisor(params, customerId);
        break;
      case "closeIncident":
        result = await closeIncident(params, authContext);
        break;
      case "createGroupForIncident":
        result = await createGroupForIncident(params, customerId);
        break;
      case "deleteCommonGroup":
        result = await deleteCommonGroup(params, customerId);
        break;
      case "deleteFireDepartment":
        result = await deleteFireDepartment(params, customerId);
        break;
      case "deleteIncident":
        result = await deleteIncident(params, authContext);
        break;
      case "deleteTemplate":
        result = await deleteTemplate(params, customerId);
        break;
      case "deleteUnitFromMaster":
        result = await deleteUnitFromMaster(params, customerId);
        break;
      case "deleteUnitType":
        result = await deleteUnitType(params, customerId);
        break;
      case "disbandGroup":
        result = await disbandGroup(params, customerId);
        break;
      case "getActiveIncidents":
        result = await getActiveIncidents(params, customerId);
        break;
      case "getAllAvailableUnitsGroupedByDept":
        result = await getAllAvailableUnitsGroupedByDept(customerId);
        break;
      case "getClosedIncidents":
        result = await getClosedIncidents(params, customerId);
        break;
      case "getCommonGroups":
        result = await getCollectionData("commonGroups", customerId);
        break;
      case "getDepartments":
        result = await getDepartments(customerId);
        break;
      case "getGroupsForIncident":
        result = await getGroupsForIncident(params, customerId);
        break;
      case "getIncidentDetails":
        result = await getIncidentDetails(params, customerId);
        break;
      case "getInitialData":
        result = await getInitialData(authContext);
        break;
      case "getSettings":
        result = await getSettings(params, customerId);
        break;
      case "getSplitUnitsForIncident":
        result = await getSplitUnitsForIncident(params, customerId);
        break;
      case "getTemplates":
        result = await getTemplates(params, customerId);
        break;
      case "getUnitTypes":
        result = await getCollectionData("unitTypes", customerId);
        break;
      case "getUnitsGroupedByStation":
        result = await getUnitsGroupedByStation(params, customerId);
        break;
      case "moveMultipleUnits":
        result = await moveMultipleUnits(params, customerId);
        break;
      case "moveUnitToNewGroup":
        result = await moveUnitToNewGroup(params, customerId);
        break;
      case "releaseMultipleUnits":
        result = await releaseMultipleUnits(params, customerId);
        break;
      case "releaseUnitToAvailable":
        result = await releaseUnitToAvailable(params, customerId);
        break;
      case "setGroupParent":
        result = await setGroupParent(params, customerId);
        break;
      case "setGroupSupervisor":
        result = await setGroupSupervisor(params, customerId);
        break;
      case "splitMultipleUnits":
        result = await splitMultipleUnits(params, customerId);
        break;
      case "splitUnit":
        result = await splitUnit(params, customerId);
        break;
      case "startNewIncident":
        result = await startNewIncident(params, authContext);
        break;
      case "startParTimer":
        result = await startParTimer(params, customerId);
        break;
      case "stopParTimer":
        result = await stopParTimer(params, customerId);
        break;
      case "unsplitUnit":
        result = await unsplitUnit(params, customerId);
        break;
      case "updateCommonGroup":
        result = await updateCommonGroup(params, customerId);
        break;
      case "updateFireDepartment":
        result = await updateFireDepartment(params, customerId);
        break;
      case "updateGroupBenchmark":
        result = await updateGroupBenchmark(params, customerId);
        break;
      case "updateGroupOrder":
        result = await updateGroupOrder(params, customerId);
        break;
      case "updateSettings":
        result = await updateSettings(params, customerId);
        break;
      case "updateTemplate":
        result = await updateTemplate(params, customerId);
        break;
      case "updateUnitInMaster":
        result = await updateUnitInMaster(params, customerId);
        break;
      case "updateUnitType":
        result = await updateUnitType(params, customerId);
        break;
      case "requestIncidentCommand":
        result = await requestIncidentCommand(params, authContext);
        break;
      case "approveCommandRequest":
        result = await approveCommandRequest(params, authContext);
        break;
      case "denyCommandRequest":
        result = await denyCommandRequest(params, authContext);
        break;
      default:
        throw new Error("Invalid action specified.");
    }
    res.status(200).json({success: true, data: result});
  } catch (error) {
    console.error(`API Error on action "${action}":`, error);
    if (error instanceof functions.https.HttpsError) {
      const status = error.httpErrorCode.status;
      // Create object first to satisfy object-curly-spacing rule
      const responseJson = {success: false, message: error.message};
      res.status(status).json(responseJson);
    } else {
      const responseJson = {success: false, message: error.message};
      res.status(500).json(responseJson);
    }
  }
});

// ===================================================================
//
//  SESSION AND COMMAND MANAGEMENT (NEW FUNCTIONS)
//
// ===================================================================

/**
 * Creates a new session for a user, implementing a hierarchical model to
 * manage a limited pool of device slots. It prioritizes re-entry for active
 * commanders, then allows bumping of truly stale devices, ensuring maximum
 * availability and stability during critical events.
 * @param {object} params The request params (can be empty).
 * @param {object} authContext The user's authorization context.
 * @return {Promise<object>} An object containing the new sessionId.
 */
async function createSession(params, authContext) {
  const {uid, customerId} = authContext;

  const customerRef = db.collection("customers").doc(customerId);
  const sessionsRef = db.collection("sessions");
  const incidentsRef = db.collection("incidents");

  const [customerDoc, currentSessionsSnapshot] = await Promise.all([
    customerRef.get(),
    sessionsRef.where("customerId", "==", customerId).get(),
  ]);

  if (!customerDoc.exists) {
    throw new functions.https.HttpsError("not-found", "Customer not found.");
  }

  const maxTotalSessions = customerDoc.data().maxTotalSessions || 1;
  const currentSessionCount = currentSessionsSnapshot.size;

  // --- CHECK #1: "Happy Path" - Is there an open slot? ---
  if (currentSessionCount < maxTotalSessions) {
    const now = new Date();
    const sessionData = {uid, customerId, loginTime: now, lastActive: now};
    const newSessionRef = await sessionsRef.add(sessionData);
    console.log(`Granted new session ${newSessionRef.id} in an open slot.`);
    return {sessionId: newSessionRef.id};
  }

  // --- SLOTS ARE FULL. PROCEED TO HIERARCHICAL CHECKS ---
  console.log(`Session limit reached for customer ${customerId}.`);

  // --- CHECK #2: "Privileged Re-entry for Commander" ---
  const commanderQuery = incidentsRef
      .where("customerId", "==", customerId)
      .where("commanderUid", "==", uid)
      .where("status", "==", "Active")
      .limit(1);

  const commanderSnapshot = await commanderQuery.get();
  if (!commanderSnapshot.empty) {
    const incidentDoc = commanderSnapshot.docs[0];
    const oldSessionId = incidentDoc.data().commanderSessionId;

    if (oldSessionId) {
      const logMsg = `Privileged re-entry: User ${uid} is an active ` +
        `commander. Bumping their old session ${oldSessionId}.`;
      console.log(logMsg);
      await sessionsRef.doc(oldSessionId).delete();
      const now = new Date();
      const sessionData = {uid, customerId, loginTime: now, lastActive: now};
      const newSessionRef = await sessionsRef.add(sessionData);
      return {sessionId: newSessionRef.id};
    }
  }

  // --- CHECK #3: "General Bumping" of Stale, Non-Commanding Sessions ---
  const now = new Date();
  const fifteenMinutesInMs = 15 * 60 * 1000;
  const staleThreshold = new Date(now.getTime() - fifteenMinutesInMs);

  const activeCmdIncidents = await incidentsRef
      .where("customerId", "==", customerId)
      .where("status", "==", "Active")
      .where("commanderSessionId", "!=", null).get();
  const commandingSessionIds = new Set();
  activeCmdIncidents.forEach((doc) => {
    commandingSessionIds.add(doc.data().commanderSessionId);
  });

  let oldestStaleSession = null;
  currentSessionsSnapshot.forEach((doc) => {
    const isCommanding = commandingSessionIds.has(doc.id);
    const lastActiveTime = doc.data().lastActive.toDate();

    if (!isCommanding && lastActiveTime < staleThreshold) {
      // --- THIS IS THE CORRECTED, LINT-COMPLIANT LINE ---
      const isOlder =
        !oldestStaleSession || lastActiveTime < oldestStaleSession.lastActive;

      if (isOlder) {
        oldestStaleSession = {id: doc.id, lastActive: lastActiveTime};
      }
    }
  });

  if (oldestStaleSession) {
    const logMsg = "Bumping oldest stale session " +
      `${oldestStaleSession.id} to make room.`;
    console.log(logMsg);
    await sessionsRef.doc(oldestStaleSession.id).delete();
    const sessionData = {uid, customerId, loginTime: now, lastActive: now};
    const newSessionRef = await sessionsRef.add(sessionData);
    return {sessionId: newSessionRef.id};
  }

  // --- CHECK #4: Hard Failure ---
  const errorMsg = "All available device slots are currently in active " +
    "use. Please log out from another device or wait for one to become " +
    "inactive.";
  throw new functions.https.HttpsError("permission-denied", errorMsg);
}

/**
 * Updates the 'lastActive' timestamp on a user's session document.
 * @param {object} params The request params containing the sessionId.
 * @param {string} params.sessionId The unique ID of the session to update.
 * @param {object} authContext The authorization context.
 * @return {Promise<object>} A success message.
 */
async function sessionHeartbeat(params, authContext) {
  const {sessionId} = params;
  if (!sessionId) {
    const errorMsg = "A sessionId is required.";
    throw new functions.https.HttpsError("invalid-argument", errorMsg);
  }
  const sessionRef = db.collection("sessions").doc(sessionId);
  const sessionDoc = await sessionRef.get();
  if (!sessionDoc.exists || sessionDoc.data().uid !== authContext.uid) {
    const errorMsg = "Session not found or access denied.";
    throw new functions.https.HttpsError("not-found", errorMsg);
  }
  await sessionRef.update({lastActive: new Date()});
  return {message: "Heartbeat received."};
}

/**
 * Checks if the current user should be locked out or in view-only mode.
 * @param {object} params The request params containing the sessionId.
 * @param {string} params.sessionId The user's current session ID.
 * @param {object} authContext The user's auth context.
 * @return {Promise<object>} A status object.
 */
async function checkSessionStatus(params, authContext) {
  const {uid, customerId, planLevel} = authContext;

  const incidentsRef = db.collection("incidents");
  const commandingQuery = incidentsRef
      .where("customerId", "==", customerId)
      .where("commanderUid", "==", uid)
      .limit(1);

  const snapshot = await commandingQuery.get();
  if (snapshot.empty) {
    return {status: "ok"};
  }

  const incidentData = snapshot.docs[0].data();
  const commandedSessionId = incidentData.commanderSessionId;

  if (planLevel === "Basic" && params.sessionId !== commandedSessionId) {
    const message = "This account is already commanding an incident " +
      "on another device. Basic plan users are limited to one " +
      "command session at a time.";
    return {
      status: "locked_out",
      message: message,
    };
  }

  if (planLevel === "Pro" && params.sessionId !== commandedSessionId) {
    const message = "This account is commanding an incident on another " +
      "device. You can observe in View-Only mode.";
    return {
      status: "view_only_recommended",
      message: message,
    };
  }

  return {status: "ok"};
}

/**
 * Allows a user to take command of an incident, enforcing all plan-based
 * rules, including department-wide and individual user limits.
 * @param {object} params The request params.
 * @param {string} params.incidentId The ID of the incident.
 * @param {string} params.sessionId The user's current session ID.
 * @param {object} authContext The user's authorization context, containing
 *     their UID and customerId.
 * @return {Promise<object>} A status object indicating success.
 */
async function takeIncidentCommand(params, authContext) {
  const {incidentId, sessionId} = params;
  const {uid, customerId} = authContext;

  if (!incidentId || !sessionId) {
    const errorMsg = "Incident ID and Session ID are required.";
    throw new functions.https.HttpsError("invalid-argument", errorMsg);
  }

  const sessionRef = db.collection("sessions").doc(sessionId);
  const sessionDoc = await sessionRef.get();
  if (!sessionDoc.exists || sessionDoc.data().uid !== uid) {
    const errorMsg = "Your session is invalid. Please log in again.";
    throw new functions.https.HttpsError("permission-denied", errorMsg);
  }

  const customerRef = db.collection("customers").doc(customerId);
  const incidentsRef = db.collection("incidents");
  const incidentRef = incidentsRef.doc(incidentId);

  return db.runTransaction(async (transaction) => {
    const [customerDoc, incidentDoc] = await Promise.all([
      transaction.get(customerRef),
      transaction.get(incidentRef),
    ]);

    if (!customerDoc.exists) {
      throw new Error("Customer profile not found.");
    }
    if (!incidentDoc.exists || incidentDoc.data().customerId !== customerId) {
      throw new Error("Incident not found or access denied.");
    }

    // Gatekeeper Check #1: Department-Level Command Licenses
    const maxCommandLicenses = customerDoc.data().maxCommandLicenses || 1;
    const commandingIncidentsQuery = incidentsRef
        .where("customerId", "==", customerId)
        .where("status", "==", "Active")
        .where("commanderUid", "!=", null);
    const commandingSnapshot = await transaction.get(commandingIncidentsQuery);

    if (commandingSnapshot.size >= maxCommandLicenses) {
      // Allow taking over your own command on another device.
      const incidentData = incidentDoc.data();
      if (incidentData.commanderUid !== uid) {
        const errorMsg = "All available command licenses for your " +
          "department are currently in use.";
        throw new functions.https.HttpsError("permission-denied", errorMsg);
      }
    }

    // Gatekeeper Check #2: Individual User Limit (1 incident per user)
    const userIncidentsQuery = incidentsRef
        .where("customerId", "==", customerId)
        .where("commanderUid", "==", uid)
        .where(admin.firestore.FieldPath.documentId(), "!=", incidentId);
    const userIncidentsSnapshot = await transaction.get(userIncidentsQuery);

    if (!userIncidentsSnapshot.empty) {
      const errorMsg = "This account is already commanding another " +
        "active incident. Please close it first.";
      throw new functions.https.HttpsError("permission-denied", errorMsg);
    }
    // End of Gatekeeper Checks

    transaction.update(incidentRef, {
      commanderUid: uid,
      commanderSessionId: sessionId,
    });

    return {status: "command_granted"};
  });
}

/**
 * Deletes a session document upon user logout.
 * @param {object} params The request params containing the sessionId.
 * @param {string} params.sessionId The unique ID of the session to delete.
 * @param {object} authContext The authorization context.
 * @return {Promise<object>} A success message.
 */
async function endSession(params, authContext) {
  const {sessionId} = params;
  if (!sessionId) {
    const errorMsg = "A sessionId is required.";
    throw new functions.https.HttpsError("invalid-argument", errorMsg);
  }

  const sessionRef = db.collection("sessions").doc(sessionId);
  const sessionDoc = await sessionRef.get();

  if (sessionDoc.exists && sessionDoc.data().uid === authContext.uid) {
    await sessionRef.delete();
    return {message: "Session ended successfully."};
  }
  return {message: "Session not found or access denied."};
}

/**
 * Creates a request for a user to take command of an incident.
 * This version now includes the requester's session ID for a clean transfer.
 * @param {object} params The request params.
 * @param {string} params.incidentId The ID of the incident.
 * @param {object} authContext The authorization context of the requester.
 * @return {Promise<object>} The new command request document.
 */
async function requestIncidentCommand(params, authContext) {
  // --- THIS IS THE NEW LINE ---
  const {incidentId, sessionId} = params;
  const {uid, name, customerId} = authContext;

  if (!incidentId || !sessionId) {
    const errorMsg = "Incident ID and Session ID are required for a request.";
    throw new functions.https.HttpsError("invalid-argument", errorMsg);
  }

  const {data: incidentData} =
    await getAndVerifyDoc("incidents", incidentId, customerId);

  if (!incidentData.commanderUid) {
    const errorMsg = "This incident is not currently commanded. " +
      "You can take command directly.";
    throw new functions.https.HttpsError("failed-precondition", errorMsg);
  }
  if (incidentData.commanderUid === uid) {
    const errorMsg = "You are already the commander of this incident.";
    throw new functions.https.HttpsError("failed-precondition", errorMsg);
  }

  const existingReqQuery = db.collection("commandRequests")
      .where("incidentId", "==", incidentId)
      .where("status", "==", "pending")
      .limit(1);
  const existingReqSnapshot = await existingReqQuery.get();
  if (!existingReqSnapshot.empty) {
    const errorMsg = "A command request for this incident is already pending.";
    throw new functions.https.HttpsError("already-exists", errorMsg);
  }

  const newRequest = {
    incidentId: incidentId,
    requesterUid: uid,
    requesterName: name,
    // --- THIS IS THE NEW FIELD ---
    requesterSessionId: sessionId,
    currentCommanderUid: incidentData.commanderUid,
    status: "pending",
    requestTimestamp: new Date(),
    customerId: customerId,
  };

  const docRef = await db.collection("commandRequests").add(newRequest);

  const logDetails = `User ${newRequest.requesterName} requested command.`;
  await logIncidentAction({
    customerId: customerId,
    incidentId: incidentId,
    eventType: "COMMAND_REQUEST",
    details: logDetails,
    metadata: {requesterUid: uid, commanderUid: incidentData.commanderUid},
  });

  return {id: docRef.id, ...newRequest};
}

/**
 * Approves a command request, transferring command to the requester.
 * This version now reads the requester's session ID from the request doc.
 * @param {object} params The request params.
 * @param {string} params.requestId The ID of the commandRequest document.
 * @param {string} params.sessionId The new commander's session ID.
 * @param {object} authContext The commander approving the request.
 * @return {Promise<object>} A success message.
 */
async function approveCommandRequest(params, authContext) {
  const {requestId} = params; // No longer need sessionId from the approver
  if (!requestId) {
    const errorMsg = "A Request ID is required to approve command.";
    throw new functions.https.HttpsError("invalid-argument", errorMsg);
  }

  const requestRef = db.collection("commandRequests").doc(requestId);

  return db.runTransaction(async (transaction) => {
    const requestDoc = await transaction.get(requestRef);
    if (!requestDoc.exists) {
      throw new Error("Command request not found.");
    }
    const requestData = requestDoc.data();

    // Security check: only the current commander can approve
    if (requestData.currentCommanderUid !== authContext.uid) {
      const authError = "You are not authorized to approve this request.";
      throw new functions.https.HttpsError("permission-denied", authError);
    }

    if (!requestData.requesterSessionId) {
      throw new Error("Cannot approve: Requester session ID is missing.");
    }

    const incidentRef = db.collection("incidents").doc(requestData.incidentId);

    transaction.update(incidentRef, {
      commanderUid: requestData.requesterUid,
      commanderSessionId: requestData.requesterSessionId,
    });

    transaction.update(requestRef, {status: "approved"});

    const logDetails = `Command transferred to ${requestData.requesterName}.`;
    await logIncidentAction({
      customerId: authContext.customerId,
      incidentId: requestData.incidentId,
      eventType: "COMMAND_APPROVED",
      details: logDetails,
      metadata: {
        approvedBy: authContext.uid,
        newCommander: requestData.requesterUid,
      },
    });
    return {message: "Command approved."};
  });
}


/**
 * Denies a command request.
 * @param {object} params The request params.
 * @param {string} params.requestId The ID of the commandRequest document.
 * @param {object} authContext The commander denying the request.
 * @return {Promise<object>} A success message.
 */
async function denyCommandRequest(params, authContext) {
  const {requestId} = params;
  if (!requestId) {
    const errorMsg = "Request ID is required.";
    throw new functions.https.HttpsError("invalid-argument", errorMsg);
  }

  const requestRef = db.collection("commandRequests").doc(requestId);
  const requestDoc = await requestRef.get();
  if (!requestDoc.exists) {
    throw new Error("Command request not found.");
  }
  const requestData = requestDoc.data();

  if (requestData.currentCommanderUid !== authContext.uid) {
    const authError = "You are not authorized to deny this request.";
    throw new functions.https.HttpsError("permission-denied", authError);
  }

  await requestRef.update({status: "denied"});

  const logDetails =
    `Command request from ${requestData.requesterName} was denied.`;
  await logIncidentAction({
    customerId: authContext.customerId,
    incidentId: requestData.incidentId,
    eventType: "COMMAND_DENIED",
    details: logDetails,
    metadata: {
      deniedBy: authContext.uid,
      requester: requestData.requesterUid,
    },
  });

  return {message: "Request denied."};
}

/**
 * Allows user to re-establish their command of an incident with a new session.
 * This is a specific action used when a commander reconnects on a new device
 * or after their previous session has expired.
 * @param {object} params The request params.
 * @param {string} params.incidentId The ID of the incident.
 * @param {string} params.sessionId The user's NEW session ID.
 * @param {object} authContext The user's authorization context.
 * @return {Promise<object>} A status object indicating success.
 */
async function reestablishCommand(params, authContext) {
  const {incidentId, sessionId} = params;
  const {uid} = authContext; // The user's UID from their ID token.

  if (!incidentId || !sessionId) {
    const errorMsg = "Incident ID and Session ID are required.";
    throw new functions.https.HttpsError("invalid-argument", errorMsg);
  }

  const incidentRef = db.collection("incidents").doc(incidentId);

  // Use a transaction to ensure the check and the update happen atomically.
  return db.runTransaction(async (transaction) => {
    const incidentDoc = await transaction.get(incidentRef);

    if (!incidentDoc.exists) {
      throw new Error("Incident not found.");
    }

    const incidentData = incidentDoc.data();

    // THIS IS THE CRITICAL SECURITY CHECK:
    // We verify that the user making this request (uid) is the same user
    // who is currently listed as the commander on the incident.
    if (incidentData.commanderUid !== uid) {
      // If they don't match, this is an unauthorized attempt.
      const errorMsg = "Permission denied. You are not the current commander.";
      throw new functions.https.HttpsError("permission-denied", errorMsg);
    }

    // If the check passes, it's safe to update the incident with the new
    // session ID, effectively resuming their command.
    transaction.update(incidentRef, {
      commanderSessionId: sessionId,
    });

    // Log this action for auditing purposes.
    const logDetails = `Commander ${authContext.name} re-established command.`;
    await logIncidentAction({
      customerId: authContext.customerId,
      incidentId: incidentId,
      eventType: "COMMAND_REESTABLISHED",
      details: logDetails,
      metadata: {uid, newSessionId: sessionId},
    });

    return {status: "command_reestablished"};
  });
}


// ===================================================================
//
//  DATA HANDLER FUNCTIONS
//
// ===================================================================

/**
 * A generic helper to create a timestamped log entry in the `incidentLog`.
 * @param {object} logData The data for the log entry.
 * @param {string} logData.customerId The customer ID.
 * @param {string} logData.incidentId The incident ID.
 * @param {string} logData.eventType The standardized event type.
 * @param {string} logData.details A human-readable description of the event.
 * @param {object} [logData.metadata={}] An object storing related IDs - data.
 * @return {Promise<void>}
 */
async function logIncidentAction(logData) {
  if (!logData.customerId || !logData.incidentId || !logData.eventType) {
    console.error("Skipping log action due to missing required data.");
    return;
  }
  await db.collection("incidentLog").add({
    timestamp: new Date(),
    ...logData,
  });
}

/**
 * A generic helper to fetch documents that belong to the customer.
 * @param {string} collectionName The name of the Firestore collection.
 * @param {string} customerId The authenticated customer's ID.
 * @return {Promise<Array<object>>} An array of document data.
 */
async function getCollectionData(collectionName, customerId) {
  const snapshot = await db.collection(collectionName)
      .where("customerId", "==", customerId)
      .get();

  if (snapshot.empty) {
    return [];
  }
  return snapshot.docs.map((doc) => ({id: doc.id, ...doc.data()}));
}

/**
 * A helper to get a single document and verify its ownership.
 * @param {string} collectionName The name of the collection.
 * @param {string} docId The ID of the document to fetch.
 * @param {string} customerId The authenticated customer's ID.
 * @return {Promise<object|null>} The document reference and data, or null.
 * @throws {Error} If the document does not belong to the customer.
 */
async function getAndVerifyDoc(collectionName, docId, customerId) {
  const docRef = db.collection(collectionName).doc(docId);
  const doc = await docRef.get();
  if (!doc.exists) {
    throw new Error(`${collectionName} document not found.`);
  }
  const data = doc.data();
  if (data.customerId !== customerId) {
    const errorMsg = `Access denied to ${collectionName} document.`;
    throw new functions.https.HttpsError("permission-denied", errorMsg);
  }
  return {ref: docRef, data: data};
}

/**
 * Fetches the latest data for a single incident.
 * @param {object} params The request params.
 * @param {string} params.incidentId The ID of the incident to fetch.
 * @param {string} customerId The authenticated customer's ID.
 * @return {Promise<object>} The full incident document data, including its ID.
 */
/**
 * Fetches the latest data for a single incident. This version guarantees that
 * the commanderSessionId is always included in the response.
 * @param {object} params The request params.
 * @param {string} params.incidentId The ID of the incident to fetch.
 * @param {string} customerId The authenticated customer's ID.
 * @return {Promise<object>} The full incident document data.
 */
async function getIncidentDetails(params, customerId) {
  const {incidentId} = params;
  if (!incidentId) {
    throw new Error("Incident ID is required.");
  }

  // --- THIS IS THE CORRECTED, LINT-COMPLIANT BLOCK ---
  // The function call is broken into multiple lines to respect the
  // 80-character limit.
  const docDetails = await getAndVerifyDoc(
      "incidents",
      incidentId,
      customerId,
  );
  const {data, ref} = docDetails;
  // --- END OF CORRECTION ---

  const startTime = data.startTime ?
    data.startTime.toDate().toISOString() :
    null;

  // Explicitly create the final return object to ensure that
  // commanderSessionId is included, even if it's null.
  const incidentDetails = {
    id: ref.id,
    ...data,
    startTime: startTime,
    commanderSessionId: data.commanderSessionId || null,
  };

  return incidentDetails;
}

/**
 * Fetches all the initial data needed to bootstrap the front-end.
 * @param {object} authContext The authorization context for the user.
 * @return {Promise<object>} An object containing all initial data for the app.
 */
async function getInitialData(authContext) {
  const {customerId, planLevel} = authContext; // Already have it here

  const [
    departments,
    unitTypes,
    commonGroups,
    templates,
    activeIncidents,
    settings,
  ] = await Promise.all([
    getDepartments(customerId),
    getCollectionData("unitTypes", customerId),
    getCollectionData("commonGroups", customerId),
    getCollectionData("templates", customerId),
    getActiveIncidents({}, customerId),
    getSettings({}, customerId),
  ]);

  return {
    // --- THIS IS THE NEW LINE ---
    customerId: customerId, // Pass the customerId to the frontend
    fireDepartments: departments,
    unitTypes,
    commonGroups,
    templates,
    activeIncidents,
    settings,
    planLevel,
  };
}

// --- Department Management ---

/**
 * Fetches departments for a customer and flags the primary department.
 * @param {string} customerId The authenticated customer's ID.
 * @return {Promise<Array<object>>} The list of department documents.
 */
async function getDepartments(customerId) {
  const customerRef = db.collection("customers").doc(customerId);
  const customerDoc = await customerRef.get();
  let primaryDeptId = null;
  if (customerDoc.exists) {
    primaryDeptId = customerDoc.data().primaryDepartmentId;
  }
  const departments = await getCollectionData("departments", customerId);
  return departments.map((dept) => ({
    ...dept,
    isPrimary: dept.id === primaryDeptId,
  }));
}

/**
 * Adds a new department for a customer.
 * @param {object} query The request query parameters.
 * @param {string} customerId The authenticated customer's ID.
 * @return {Promise<object>} The new department document.
 */
async function addDepartment(query, customerId) {
  const {departmentName, abbreviation} = query;
  if (!departmentName) throw new Error("Department name is required.");

  const newDeptData = {
    departmentName: departmentName.trim(),
    abbreviation: abbreviation ? abbreviation.trim() : null,
    customerId: customerId, // Tag with customerId
  };

  const docRef = await db.collection("departments").add(newDeptData);
  return {id: docRef.id, ...newDeptData};
}

/**
 * Updates a fire department for a customer after verifying ownership.
 * @param {object} query The request query parameters.
 * @param {string} customerId The authenticated customer's ID.
 * @return {Promise<object>} A success message.
 */
async function updateFireDepartment(query, customerId) {
  // Use `departmentId` consistently.
  const {departmentId, departmentName, abbreviation} = query;
  if (!departmentId || !departmentName) {
    throw new Error("Department ID and Name are required.");
  }

  // Pass the consistent variable to the helper function.
  const {ref} = await getAndVerifyDoc("departments", departmentId, customerId);

  await ref.update({
    departmentName: departmentName.trim(),
    abbreviation: abbreviation ? abbreviation.trim() : null,
  });
  return {message: "Department updated successfully."};
}

/**
 * Deletes a fire department for a customer after verifying ownership.
 * @param {object} query The request query parameters.
 * @param {string} customerId The authenticated customer's ID.
 * @return {Promise<object>} A success message.
 */
async function deleteFireDepartment(query, customerId) {
  // Use `departmentId` consistently.
  const {departmentId} = query;
  if (!departmentId) {
    throw new Error("Department ID is required.");
  }

  const {ref} = await getAndVerifyDoc("departments", departmentId, customerId);

  // CRITICAL: Query the units collection using the CORRECT new field name.
  const unitsSnapshot = await db.collection("units")
      .where("customerId", "==", customerId)
      .where("departmentId", "==", departmentId) // This line is now correct.
      .limit(1)
      .get();

  if (!unitsSnapshot.empty) {
    throw new Error("Cannot delete department. It is in use by units.");
  }
  await ref.delete();
  return {message: "Department deleted successfully."};
}


// --- Unit & Unit Type Management ---

/**
 * Adds a new unit type for a customer.
 * @param {object} query The request query parameters.
 * @param {string} customerId The authenticated customer's ID.
 * @return {Promise<object>} The new unit type document.
 */
async function addUnitType(query, customerId) {
  const {typeName, description} = query;
  if (!typeName) throw new Error("Unit Type Name is required.");

  const newTypeData = {
    typeName: typeName.trim(),
    description: description ? description.trim() : null,
    customerId: customerId,
  };

  const docRef = await db.collection("unitTypes").add(newTypeData);
  return {id: docRef.id, ...newTypeData};
}

/**
 * Updates a unit type for a customer after verifying ownership.
 * @param {object} query The request query parameters.
 * @param {string} customerId The authenticated customer's ID.
 * @return {Promise<object>} A success message.
 */
async function updateUnitType(query, customerId) {
  const {unitTypeId, typeName, description} = query;
  if (!unitTypeId || !typeName) {
    throw new Error("Unit Type ID and a new Name are required.");
  }
  const {ref} = await getAndVerifyDoc("unitTypes", unitTypeId, customerId);
  await ref.update({
    typeName: typeName.trim(),
    description: description ? description.trim() : null,
  });
  return {message: "Unit Type updated successfully."};
}

/**
 * Deletes a unit type for a customer after verifying ownership.
 * @param {object} query The request query parameters.
 * @param {string} customerId The authenticated customer's ID.
 * @return {Promise<object>} A success message.
 */
async function deleteUnitType(query, customerId) {
  const {unitTypeId} = query;
  if (!unitTypeId) throw new Error("Unit Type ID is required.");

  const {ref} = await getAndVerifyDoc("unitTypes", unitTypeId, customerId);
  const unitsSnapshot = await db.collection("units")
      .where("customerId", "==", customerId)
      .where("unitTypeId", "==", unitTypeId)
      .limit(1)
      .get();

  if (!unitsSnapshot.empty) {
    throw new Error("Cannot delete type. It is in use by one or more units.");
  }
  await ref.delete();
  return {message: "Unit Type deleted successfully."};
}

/**
 * Fetches the master list of ALL units and groups them into a flat list
 * under their respective departments, ready for a sortable table view.
 * @param {object} query The request query parameters.
 * @param {string} customerId The authenticated customer's ID.
 * @return {Promise<Array<object>>} An array of department objects, each
 *                                  containing a flat list of its units.
 */
async function getUnitsGroupedByStation(query, customerId) {
  // Step 1: Fetch all departments and all units for the customer.
  const [depts, allUnits] = await Promise.all([
    getCollectionData("departments", customerId),
    getCollectionData("units", customerId),
  ]);

  // Step 2: Group all units by their `departmentId`.
  const unitsByDeptId = allUnits.reduce((acc, unit) => {
    const key = unit.departmentId;
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(unit);
    return acc;
  }, {});

  // Step 3: Map over the departments to build the final structure.
  // This block has been re-indented to match the linter's specific rules.
  const result = depts.map((dept) => {
    const unitsForDept = unitsByDeptId[dept.id] || [];

    dept.units = unitsForDept.sort(
        (a, b) => (a.unit || "").localeCompare(b.unit || ""),
    );

    return dept;
  });

  return result;
}

/**
 * Adds a new unit to the master list for a customer.
 * Now takes the full authContext to check for planLevel limits.
 * @param {object} query The request query parameters.
 * @param {object} authContext The full authorization context.
 * @return {Promise<object>} The new unit document.
 */
async function addUnitToMaster(query, authContext) {
  const {customerId, planLevel} = authContext;
  const {
    departmentId, unit, unitTypeId, unitName, status, notes, stationName,
  } = query;
  if (!departmentId || !unit || !unitTypeId || !unitName || !status) {
    throw new Error("All required fields must be provided.");
  }
  if (planLevel === "Basic") {
    const unitsRef = db.collection("units");
    const unitsQuery = unitsRef.where("customerId", "==", customerId);
    const unitsSnapshot = await unitsQuery.get();
    if (unitsSnapshot.size >= 50) {
      const errorMsg = "Unit limit reached. Upgrade to add more units.";
      throw new functions.https.HttpsError("permission-denied", errorMsg);
    }
  }
  const newUnitData = {
    departmentId,
    unit: unit.trim().toUpperCase(),
    unitTypeId,
    unitName: unitName.trim(),
    status,
    notes: notes ? notes.trim() : null,
    stationName: stationName ? stationName.trim() : null,
    customerId,
    isSplit: false,
    splitStatus: "Original",
    parentUnitId: null,
  };
  const docRef = await db.collection("units").add(newUnitData);
  return {id: docRef.id, ...newUnitData};
}

/**
 * Updates a master unit record for a customer after verifying ownership.
 * This version uses departmentId and is fully lint-compliant.
 * @param {object} query The request query parameters.
 * @param {string} customerId The authenticated customer's ID.
 * @return {Promise<object>} The updated unit document.
 */
async function updateUnitInMaster(query, customerId) {
  const {
    unitId,
    departmentId,
    unit,
    unitTypeId,
    unitName,
    status,
    notes,
    stationName,
  } = query;

  // This long `if` statement was violating the max-len rule.
  // It is replaced with a more readable array-based check.
  const requiredFields = [
    unitId, departmentId, unit, unitTypeId, unitName, status,
  ];
  if (requiredFields.some((field) => !field)) {
    const errorMsg = "All required fields must be provided for unit update.";
    throw new Error(errorMsg);
  }

  const {ref} = await getAndVerifyDoc("units", unitId, customerId);

  const updatedData = {
    departmentId,
    unit: unit.trim().toUpperCase(),
    unitTypeId,
    unitName: unitName.trim(),
    status,
    notes: notes ? notes.trim() : null,
    stationName: stationName ? stationName.trim() : null,
  };
  await ref.update(updatedData);
  return {id: unitId, ...updatedData};
}

/**
 * Deletes a unit from the master list for a customer.
 * @param {object} query The request query parameters.
 * @param {string} customerId The authenticated customer's ID.
 * @return {Promise<object>} A success message.
 */
async function deleteUnitFromMaster(query, customerId) {
  const {unitId} = query;
  if (!unitId) throw new Error("Unit ID is required.");
  const {ref} = await getAndVerifyDoc("units", unitId, customerId);
  await ref.delete();
  return {message: "Unit deleted successfully."};
}


// --- Library (Common Group & Template) Management ---

/**
 * Adds a new common group for a customer.
 * @param {object} query The request query parameters.
 * @param {string} customerId The authenticated customer's ID.
 * @return {Promise<object>} The new common group document.
 */
async function addCommonGroup(query, customerId) {
  const {name, color} = query;
  if (!name) throw new Error("A group name is required.");
  const newGroupData = {
    name: name.trim(),
    color: color || "#6c757d",
    customerId,
  };
  const docRef = await db.collection("commonGroups").add(newGroupData);
  return {id: docRef.id, ...newGroupData};
}

/**
 * Updates a common group and performs a cascading update to any templates
 * that use the old group name. This version correctly orders reads and writes.
 * @param {object} query The request query parameters.
 * @param {string} customerId The authenticated customer's ID.
 * @return {Promise<object>} A success message.
 */
async function updateCommonGroup(query, customerId) {
  const {groupId, name, color} = query;
  if (!groupId || !name || !name.trim()) {
    throw new Error("Group ID and a new Name are required.");
  }
  const newName = name.trim();
  const newColor = color || "#6c757d";

  const groupRef = db.collection("commonGroups").doc(groupId);
  const templatesRef = db.collection("templates");

  return db.runTransaction(async (transaction) => {
    // --- STEP 1: ALL READS MUST HAPPEN FIRST ---
    const groupDoc = await transaction.get(groupRef);

    if (!groupDoc.exists) {
      throw new Error("Common Group not found.");
    }
    const groupData = groupDoc.data();
    if (groupData.customerId !== customerId) {
      // Corrected for max-len
      const errorMsg = "Access denied to Common Group document.";
      throw new functions.https.HttpsError("permission-denied", errorMsg);
    }

    const oldName = groupData.name;

    // Only search for templates if the name is actually changing.
    let templatesToUpdate = [];
    if (oldName !== newName) {
      const templatesQuery = templatesRef
          .where("customerId", "==", customerId)
          .where("groups", "array-contains", oldName);
      const templatesSnapshot = await transaction.get(templatesQuery);
      templatesToUpdate = templatesSnapshot.docs;
    }

    // --- STEP 2: ALL WRITES HAPPEN AFTER ALL READS ---
    transaction.update(groupRef, {name: newName, color: newColor});

    if (templatesToUpdate.length > 0) {
      templatesToUpdate.forEach((doc) => {
        const templateRef = doc.ref;
        const oldGroups = doc.data().groups;
        // Corrected for max-len and arrow-parens
        const newGroups = oldGroups.map((groupName) => (
          groupName === oldName ? newName : groupName
        ));
        transaction.update(templateRef, {groups: newGroups});
      });
    }

    // --- STEP 3: RETURN SUCCESS MESSAGE ---
    const updateMsg = "Common Group and linked templates updated.";
    if (oldName !== newName && templatesToUpdate.length > 0) {
      return {message: updateMsg};
    } else {
      return {message: "Common Group updated successfully."};
    }
  });
}

/**
 * Deletes a common group for a customer after verifying ownership.
 * @param {object} query The request query parameters.
 * @param {string} customerId The authenticated customer's ID.
 * @return {Promise<object>} A success message.
 */
async function deleteCommonGroup(query, customerId) {
  const {groupId, groupName} = query;

  // Corrected to meet the 80-character limit.
  if (!groupId || !groupName) {
    throw new Error("Group ID and Name are required.");
  }

  const {ref} = await getAndVerifyDoc("commonGroups", groupId, customerId);

  const snapshot = await db.collection("templates")
      .where("customerId", "==", customerId)
      .where("groups", "array-contains", groupName)
      .limit(1)
      .get();

  if (!snapshot.empty) {
    throw new Error("Cannot delete group. It is in use by templates.");
  }

  await ref.delete();
  return {message: "Common Group deleted successfully."};
}

/**
 * Fetches all templates for a customer.
 * @param {object} query The request query parameters.
 * @param {string} customerId The authenticated customer's ID.
 * @return {Promise<Array<object>>} A list of template documents.
 */
async function getTemplates(query, customerId) {
  const templates = await getCollectionData("templates", customerId);
  templates.sort((a, b) => {
    return (a.templateName || "").localeCompare(b.templateName || "");
  });
  return templates;
}

/**
 * Adds a new template for a customer.
 * @param {object} query The request query parameters.
 * @param {string} customerId The authenticated customer's ID.
 * @return {Promise<object>} The new template document.
 */
async function addTemplate(query, customerId) {
  const {templateName, groups} = query;
  if (!templateName) throw new Error("Template Name is required.");
  const newTemplateData = {
    templateName: templateName.trim(),
    groups: groups ? groups.split(",") : [],
    customerId,
  };
  const docRef = await db.collection("templates").add(newTemplateData);
  return {id: docRef.id, ...newTemplateData};
}

/**
 * Updates a template for a customer after verifying ownership.
 * @param {object} query The request query parameters.
 * @param {string} customerId The authenticated customer's ID.
 * @return {Promise<object>} A success message.
 */
async function updateTemplate(query, customerId) {
  const {templateId, templateName, groups} = query;
  if (!templateId || !templateName) {
    throw new Error("Template ID and Name are required.");
  }
  const {ref} = await getAndVerifyDoc("templates", templateId, customerId);
  await ref.update({
    templateName: templateName.trim(),
    groups: groups ? groups.split(",") : [],
  });
  return {message: "Template updated successfully."};
}

/**
 * Deletes a template for a customer after verifying ownership.
 * @param {object} query The request query parameters.
 * @param {string} customerId The authenticated customer's ID.
 * @return {Promise<object>} A success message.
 */
async function deleteTemplate(query, customerId) {
  const {templateId} = query;
  if (!templateId) throw new Error("Template ID is required.");
  const {ref} = await getAndVerifyDoc("templates", templateId, customerId);
  await ref.delete();
  return {message: "Template deleted successfully."};
}


// --- Incident Management ---

/**
 * Fetches all active incidents for a customer.
 * @param {object} query The request query parameters.
 * @param {string} customerId The authenticated customer's ID.
 * @return {Promise<Array<object>>} A list of active incident documents.
 */
async function getActiveIncidents(query, customerId) {
  const snapshot = await db.collection("incidents")
      .where("customerId", "==", customerId)
      .where("status", "==", "Active")
      .get();
  if (snapshot.empty) {
    return [];
  }
  return snapshot.docs.map((doc) => {
    const data = doc.data();
    // This ternary operator is now formatted to be lint-compliant.
    const startTime = data.startTime ?
      data.startTime.toDate().toISOString() :
      null;
    return {
      id: doc.id,
      ...data,
      commanderUid: data.commanderUid || null,
      startTime: startTime,
    };
  });
}

/**
 * Fetches all closed incidents for a customer.
 * @param {object} query The request query parameters.
 * @param {string} customerId The authenticated customer's ID.
 * @return {Promise<Array<object>>} A list of closed incident documents.
 */
async function getClosedIncidents(query, customerId) {
  const snapshot = await db.collection("incidents")
      .where("customerId", "==", customerId)
      .where("status", "==", "Closed")
      .orderBy("endTime", "desc")
      .get();
  if (snapshot.empty) return [];
  return snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      startTime: data.startTime ? data.startTime.toDate().toISOString() : null,
      endTime: data.endTime ? data.endTime.toDate().toISOString() : null,
    };
  });
}

/**
 * Starts a new incident, enforcing all command license rules.
 * @param {object} query The request query parameters.
 * @param {object} authContext The full authorization context.
 * @return {Promise<object>} The new incident document.
 */
async function startNewIncident(query, authContext) {
  const {uid, customerId} = authContext;
  const {incidentNumber, incidentName, sessionId} = query;

  if (!sessionId) {
    const errorMsg = "A valid sessionId is required to start an incident.";
    throw new functions.https.HttpsError("invalid-argument", errorMsg);
  }

  // --- GATEKEEPER CHECKS ---
  const customerRef = db.collection("customers").doc(customerId);
  const incidentsRef = db.collection("incidents");

  const customerDoc = await customerRef.get();
  if (!customerDoc.exists) {
    throw new Error("Customer profile not found.");
  }

  // Check #1: Department-Level Command Licenses
  const maxCommandLicenses = customerDoc.data().maxCommandLicenses || 1;
  const commandingQuery = incidentsRef
      .where("customerId", "==", customerId)
      .where("status", "==", "Active")
      .where("commanderUid", "!=", null);
  const commandingSnapshot = await commandingQuery.get();

  if (commandingSnapshot.size >= maxCommandLicenses) {
    const errorMsg = "All available command licenses for your " +
      "department are currently in use.";
    throw new functions.https.HttpsError("permission-denied", errorMsg);
  }

  // Check #2: Individual User Limit
  const userIncidentsQuery = incidentsRef
      .where("customerId", "==", customerId)
      .where("commanderUid", "==", uid)
      .where("status", "==", "Active")
      .limit(1);
  const userIncidentsSnapshot = await userIncidentsQuery.get();
  if (!userIncidentsSnapshot.empty) {
    const errorMsg = "This account is already commanding another " +
      "active incident. Please close it first.";
    throw new functions.https.HttpsError("failed-precondition", errorMsg);
  }
  // --- END OF GATEKEEPER CHECKS ---

  const ts = new Date();
  const year = ts.getFullYear();
  const month = (ts.getMonth() + 1).toString().padStart(2, "0");
  const day = ts.getDate().toString().padStart(2, "0");
  const hours = ts.getHours().toString().padStart(2, "0");
  const minutes = ts.getMinutes().toString().padStart(2, "0");

  let numberToSave = `${year}${month}${day}-${hours}${minutes}`;
  if (incidentNumber && incidentNumber.trim() !== "") {
    numberToSave = incidentNumber.trim();
  }

  const newIncidentData = {
    incidentNumber: numberToSave,
    incidentName: incidentName ? incidentName.trim() : null,
    startTime: ts,
    status: "Active",
    endTime: null,
    customerId,
    commanderUid: uid,
    commanderSessionId: sessionId,
  };
  const docRef = await db.collection("incidents").add(newIncidentData);
  const startTime = newIncidentData.startTime.toISOString();
  return {
    id: docRef.id,
    ...newIncidentData,
    startTime: startTime,
  };
}

/**
 * Closes an incident, releasing all units and cleaning up split units.
 * @param {object} params The request query parameters.
 * @param {string} params.incidentId The ID of the incident to close.
 * @param {object} authContext The authorization context.
 * @return {Promise<object>} A success message.
 */
async function closeIncident(params, authContext) {
  const {incidentId} = params;
  if (!incidentId) {
    throw new Error("Incident ID is required.");
  }

  const {uid, customerId} = authContext;
  const {ref: incidentRef, data: incidentData} =
    await getAndVerifyDoc("incidents", incidentId, customerId);

  if (incidentData.commanderUid !== uid) {
    const errorMsg = "Only the active commander can close this incident.";
    throw new functions.https.HttpsError("permission-denied", errorMsg);
  }

  const now = new Date();
  const batch = db.batch();
  const unitsRef = db.collection("units");

  const assignQuery = db.collection("assignments")
      .where("customerId", "==", customerId)
      .where("incidentId", "==", incidentId)
      .where("releaseTime", "==", null);
  const assignSnapshot = await assignQuery.get();

  if (assignSnapshot.empty) {
    batch.update(incidentRef, {
      status: "Closed",
      endTime: now,
      commanderUid: null,
      commanderSessionId: null,
    });
    await batch.commit();
    return {message: "Incident closed successfully."};
  }

  const assignedUnitIds = assignSnapshot.docs.map((doc) => doc.data().unitId);
  const assignedUnitsQuery = unitsRef.where(
      admin.firestore.FieldPath.documentId(), "in", assignedUnitIds,
  );
  const assignedUnitsSnapshot = await assignedUnitsQuery.get();
  const parentIds = new Set();
  const subunitIds = new Set();

  assignedUnitsSnapshot.forEach((doc) => {
    const unitData = doc.data();
    if (unitData.parentUnitId) {
      parentIds.add(unitData.parentUnitId);
      subunitIds.add(doc.id);
    }
  });

  if (parentIds.size > 0) {
    const parentUnitsQuery = unitsRef.where(
        admin.firestore.FieldPath.documentId(), "in", [...parentIds],
    );
    const parentUnitsSnapshot = await parentUnitsQuery.get();
    parentUnitsSnapshot.forEach((doc) => {
      batch.update(doc.ref, {isSplit: false, status: "Available"});
    });
  }

  subunitIds.forEach((unitId) => batch.delete(unitsRef.doc(unitId)));

  assignSnapshot.forEach((doc) => {
    batch.update(doc.ref, {
      releaseTime: now,
      notes: "Released on incident closure",
    });
    const unitId = doc.data().unitId;
    const isParent = parentIds.has(unitId);
    const isSubunit = subunitIds.has(unitId);
    if (!isParent && !isSubunit) {
      const unitDoc = assignedUnitsSnapshot.docs.find((d) => d.id === unitId);
      if (unitDoc && unitDoc.data().status !== "Out of Service") {
        batch.update(unitsRef.doc(unitId), {status: "Available"});
      }
    }
  });

  batch.update(incidentRef, {
    status: "Closed",
    endTime: now,
    commanderUid: null,
    commanderSessionId: null,
  });
  await batch.commit();

  const successMsg =
    "Incident closed, all units released, and split units reformed.";
  return {message: successMsg};
}


/**
 * Applies a template to an incident for a customer.
 * @param {object} query The request query parameters.
 * @param {string} customerId The authenticated customer's ID.
 * @return {Promise<object>} A success message.
 */
async function applyTemplateToIncident(query, customerId) {
  const {incidentId, templateId} = query;
  if (!incidentId || !templateId) {
    throw new Error("Incident and Template IDs are required.");
  }
  await getAndVerifyDoc("incidents", incidentId, customerId);
  const {data: templateData} = await getAndVerifyDoc(
      "templates", templateId, customerId);

  const groupsToCreate = templateData.groups || [];
  if (groupsToCreate.length === 0) {
    return {message: "Template has no groups to apply."};
  }

  const batch = db.batch();
  const groupsRef = db.collection("groups");
  const creationTime = new Date();

  groupsToCreate.forEach((groupName, index) => {
    const newGroupRef = groupsRef.doc();
    batch.set(newGroupRef, {
      incidentId,
      groupName,
      status: "Active",
      creationTime,
      displayOrder: index,
      fireBenchmark: "Pending",
      searchBenchmark: "Pending",
      extensionBenchmark: "Pending",
      groupSupervisorUnitId: null,
      parentGroupId: null,
      parStartTime: null,
      parStatus: "Idle",
      customerId,
    });
  });

  await batch.commit();
  return {message: `${groupsToCreate.length} group(s) applied from template.`};
}


// --- Group & Assignment Management ---

/**
 * Fetches available units and groups them into a flat list.
 * @param {string} customerId The authenticated customer's ID.
 * @return {Promise<object>} An object containing the assembled hierarchy.
 */
async function getAllAvailableUnitsGroupedByDept(customerId) {
  const [depts, allUnits] = await Promise.all([
    getDepartments(customerId),
    getCollectionData("units", customerId),
  ]);

  const availableUnits = allUnits.filter((u) => u.status === "Available");

  const unitsByDeptId = availableUnits.reduce((acc, unit) => {
    const key = unit.departmentId;
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(unit);
    return acc;
  }, {});

  const groupedResult = depts
      .map((dept) => {
        const unitsForDept = unitsByDeptId[dept.id] || [];
        dept.units = unitsForDept.sort(
            (a, b) => (a.unit || "").localeCompare(b.unit || ""),
        );
        return dept;
      })
      .filter((dept) => dept.units.length > 0);

  return {departmentsWithUnits: groupedResult};
}

/**
 * Fetches all groups for a specific incident and enriches them with related
 * data. This version now filters out any groups marked as 'Disbanded'.
 * @param {object} query The request query parameters.
 * @param {string} customerId The authenticated customer's ID.
 * @return {Promise<Array<object>>} A list of active group documents.
 */
async function getGroupsForIncident(query, customerId) {
  const {incidentId} = query;
  if (!incidentId) throw new Error("Incident ID is required.");
  await getAndVerifyDoc("incidents", incidentId, customerId);

  const groupsQuery = db.collection("groups")
      .where("customerId", "==", customerId)
      .where("incidentId", "==", incidentId)
      // THE FIX: Only get groups that are NOT Disbanded.
      .where("status", "!=", "Disbanded")
      .orderBy("status") // Required for the inequality filter
      .orderBy("displayOrder")
      .get();

  // The rest of the function remains the same...
  const assignmentsQuery = db.collection("assignments")
      .where("customerId", "==", customerId)
      .where("incidentId", "==", incidentId)
      .where("releaseTime", "==", null).get();
  const unitsQuery = db.collection("units")
      .where("customerId", "==", customerId).get();
  const commonGroupsQuery = db.collection("commonGroups")
      .where("customerId", "==", customerId).get();

  const [
    groupsSnapshot,
    assignmentsSnapshot,
    unitsSnapshot,
    commonGroupsSnapshot,
  ] = await Promise.all([
    groupsQuery,
    assignmentsQuery,
    unitsQuery,
    commonGroupsQuery,
  ]);

  if (groupsSnapshot.empty) return [];

  const unitIdDataPairs = unitsSnapshot.docs.map((d) => [d.id, d.data()]);
  const masterUnitsMap = new Map(unitIdDataPairs);
  const colorNamePairs = commonGroupsSnapshot.docs.map((d) => [
    d.data().name,
    d.data().color,
  ]);
  const colorMap = new Map(colorNamePairs);
  const assignmentsByGroup = new Map();
  assignmentsSnapshot.forEach((doc) => {
    const assignment = doc.data();
    if (!assignmentsByGroup.has(assignment.groupId)) {
      assignmentsByGroup.set(assignment.groupId, []);
    }
    assignmentsByGroup.get(assignment.groupId).push(assignment);
  });

  return groupsSnapshot.docs.map((doc) => {
    const group = {id: doc.id, ...doc.data()};
    group.units = (assignmentsByGroup.get(group.id) || []).map((assignment) => {
      const unitDetails = masterUnitsMap.get(assignment.unitId) || {};
      return {
        ...unitDetails,
        unitId: assignment.unitId,
        assignmentTime: assignment.assignmentTime.toDate().toISOString(),
      };
    });
    if (group.groupSupervisorUnitId) {
      const sup = masterUnitsMap.get(group.groupSupervisorUnitId);
      group.groupSupervisorName = sup ? sup.unit : "Unknown";
    }
    group.headerColor = colorMap.get(group.groupName) || "#6c757d";
    group.creationTime = group.creationTime?.toDate().toISOString();
    group.supervisorAssignmentTime =
      group.supervisorAssignmentTime?.toDate().toISOString();
    group.parStartTime = group.parStartTime?.toDate().toISOString();
    return group;
  });
}

/**
 * Creates a new group for an incident for a customer.
 * @param {object} query The request query parameters.
 * @param {string} customerId The authenticated customer's ID.
 * @return {Promise<object>} The new group document.
 */
async function createGroupForIncident(query, customerId) {
  const {incidentId, groupName, displayOrder} = query;
  if (!incidentId || !groupName) {
    throw new Error("Incident ID and Group Name are required.");
  }
  await getAndVerifyDoc("incidents", incidentId, customerId);

  const newGroupData = {
    incidentId,
    groupName: groupName.trim(),
    status: "Active",
    creationTime: new Date(),
    displayOrder: displayOrder ? parseInt(displayOrder, 10) : 99,
    fireBenchmark: "Pending",
    searchBenchmark: "Pending",
    extensionBenchmark: "Pending",
    groupSupervisorUnitId: null,
    parentGroupId: null,
    parStartTime: null,
    parStatus: "Idle",
    customerId,
  };
  const docRef = await db.collection("groups").add(newGroupData);

  return {
    id: docRef.id,
    ...newGroupData,
    creationTime: newGroupData.creationTime.toISOString(),
  };
}

/**
 * Assigns units to group for customer after verifying ownership of all docs.
 * @param {object} query The request query parameters.
 * @param {string} customerId The authenticated customer's ID.
 * @return {Promise<object>} A success message.
 */
async function assignUnitsToGroup(query, customerId) {
  const {incidentId, groupId, unitIds} = query;
  if (!incidentId || !groupId || !unitIds) {
    throw new Error("All parameters are required.");
  }
  await getAndVerifyDoc("incidents", incidentId, customerId);
  await getAndVerifyDoc("groups", groupId, customerId);

  const unitIdArray = unitIds.split(",");
  const batch = db.batch();
  for (const unitId of unitIdArray) {
    await getAndVerifyDoc("units", unitId, customerId);
    const newAssignmentRef = db.collection("assignments").doc();
    batch.set(newAssignmentRef, {
      incidentId,
      groupId,
      unitId,
      assignmentTime: new Date(),
      releaseTime: null,
      notes: "Assigned to group",
      customerId,
    });
    const unitRef = db.collection("units").doc(unitId);
    batch.update(unitRef, {status: "Assigned"});
  }

  await batch.commit();
  return {message: `${unitIdArray.length} unit(s) assigned successfully.`};
}

/**
 * Moves a unit to a new group for a customer after verifying ownership.
 * @param {object} query The request query parameters.
 * @param {string} customerId The authenticated customer's ID.
 * @return {Promise<object>} A success message.
 */
async function moveUnitToNewGroup(query, customerId) {
  const {incidentId, unitId, newGroupId} = query;
  if (!incidentId || !unitId || !newGroupId) {
    throw new Error("All parameters are required.");
  }
  await getAndVerifyDoc("incidents", incidentId, customerId);
  await getAndVerifyDoc("units", unitId, customerId);
  await getAndVerifyDoc("groups", newGroupId, customerId);

  const assignmentsRef = db.collection("assignments");
  const snapshot = await assignmentsRef
      .where("customerId", "==", customerId)
      .where("incidentId", "==", incidentId)
      .where("unitId", "==", unitId)
      .where("releaseTime", "==", null)
      .limit(1).get();

  if (snapshot.empty) {
    throw new Error("Could not find an active assignment for this unit.");
  }
  const oldAssignmentDoc = snapshot.docs[0];
  if (oldAssignmentDoc.data().groupId === newGroupId) {
    return {message: "Unit is already in the target group."};
  }

  const batch = db.batch();
  batch.update(oldAssignmentDoc.ref, {
    releaseTime: new Date(),
    notes: "Moved to new group",
  });

  const newAssignmentRef = db.collection("assignments").doc();
  batch.set(newAssignmentRef, {
    incidentId,
    groupId: newGroupId,
    unitId,
    assignmentTime: new Date(),
    releaseTime: null,
    notes: "Assigned via move",
    customerId,
  });

  await batch.commit();
  return {message: `Unit ${unitId} moved successfully.`};
}

/**
 * Releases a unit to be available for a customer after verifying ownership.
 * @param {object} query The request query parameters.
 * @param {string} customerId The authenticated customer's ID.
 * @return {Promise<object>} A success message.
 */
async function releaseUnitToAvailable(query, customerId) {
  const {incidentId, unitId} = query;
  if (!incidentId || !unitId) {
    throw new Error("Incident and Unit IDs are required.");
  }
  await getAndVerifyDoc("incidents", incidentId, customerId);
  const {data: unitData, ref: unitRef} =
    await getAndVerifyDoc("units", unitId, customerId);

  const snapshot = await db.collection("assignments")
      .where("customerId", "==", customerId)
      .where("incidentId", "==", incidentId)
      .where("unitId", "==", unitId)
      .where("releaseTime", "==", null)
      .limit(1).get();

  const batch = db.batch();
  if (!snapshot.empty) {
    batch.update(snapshot.docs[0].ref, {
      releaseTime: new Date(),
      notes: "Released to available",
    });
  }

  if (unitData.status !== "Out of Service") {
    batch.update(unitRef, {status: "Available"});
  }

  await batch.commit();
  return {message: "Unit released to available pool."};
}

/**
 * Sets the supervisor for a group for a customer after verifying ownership.
 * Now creates a permanent log of this action in the `incidentLog`.
 * @param {object} query The request query parameters.
 * @param {string} customerId The authenticated customer's ID.
 * @return {Promise<object>} A success message.
 */
async function setGroupSupervisor(query, customerId) {
  const {groupId, unitId, incidentId} = query;
  if (!groupId || !unitId || !incidentId) {
    throw new Error("All parameters are required.");
  }
  await getAndVerifyDoc("incidents", incidentId, customerId);
  const {ref: groupRef, data: groupData} =
    await getAndVerifyDoc("groups", groupId, customerId);
  const {data: unitData} =
    await getAndVerifyDoc("units", unitId, customerId);

  // Update the live state of the group document.
  await groupRef.update({
    groupSupervisorUnitId: unitId,
    supervisorAssignmentTime: new Date(),
  });

  // Create a permanent log of the action.
  // This block is now formatted to be under 80 characters per line.
  const details =
    `Unit ${unitData.unit} set as supervisor for group ${groupData.groupName}.`;
  await logIncidentAction({
    customerId,
    incidentId,
    eventType: "SUPERVISOR_SET",
    details: details,
    metadata: {
      groupId,
      unitId,
      groupName: groupData.groupName,
      unitName: unitData.unit,
    },
  });

  return {message: "Supervisor set successfully."};
}

/**
 * Clears the supervisor from a group for a customer.
 * Now creates a permanent log of this action before clearing the state.
 * @param {object} query The request query parameters.
 * @param {string} customerId The authenticated customer's ID.
 * @return {Promise<object>} A success message.
 */
async function clearGroupSupervisor(query, customerId) {
  const {groupId} = query;
  if (!groupId) throw new Error("Group ID is required.");
  const {ref: groupRef, data: groupData} =
    await getAndVerifyDoc("groups", groupId, customerId);

  // Log the action *before* clearing the data.
  if (groupData.groupSupervisorUnitId) {
    const {data: unitData} = await getAndVerifyDoc(
        "units",
        groupData.groupSupervisorUnitId,
        customerId,
    );
    // This block is now formatted to be under 80 characters per line.
    const details =
      `Supervisor ${unitData.unit} cleared from group ${groupData.groupName}.`;
    await logIncidentAction({
      customerId,
      incidentId: groupData.incidentId,
      eventType: "SUPERVISOR_CLEARED",
      details: details,
      metadata: {
        groupId,
        unitId: groupData.groupSupervisorUnitId,
        groupName: groupData.groupName,
        unitName: unitData.unit,
      },
    });
  }

  // Now, update the live state.
  await groupRef.update({
    groupSupervisorUnitId: null,
    supervisorAssignmentTime: null,
  });

  return {message: "Supervisor cleared successfully."};
}

/**
 * Updates a benchmark for a group for a customer.
 * Now creates a permanent log of every benchmark status change.
 * @param {object} query The request query parameters.
 * @param {string} customerId The authenticated customer's ID.
 * @return {Promise<object>} A success message.
 */
async function updateGroupBenchmark(query, customerId) {
  const {groupId, benchmarkName, newStatus} = query;
  if (!groupId || !benchmarkName || !newStatus) {
    throw new Error("All parameters are required.");
  }
  const {ref: groupRef, data: groupData} =
    await getAndVerifyDoc("groups", groupId, customerId);

  const validBenchmarks = [
    "fireBenchmark",
    "searchBenchmark",
    "extensionBenchmark",
  ];
  if (!validBenchmarks.includes(benchmarkName)) {
    throw new Error("Invalid benchmark name.");
  }

  // Update the live state of the group document with timestamps.
  const now = new Date();
  const groupUpdateData = {[benchmarkName]: newStatus};
  if (newStatus === "Started") {
    groupUpdateData[`${benchmarkName}StartTime`] = now;
  }
  if (newStatus === "Completed") {
    groupUpdateData[`${benchmarkName}CompletionTime`] = now;
  }
  await groupRef.update(groupUpdateData);

  // Create a permanent log of the action.
  // This block is now formatted to be under 80 characters per line.
  const friendlyBenchmarkName = benchmarkName.replace("Benchmark", "");
  const details =
    `Benchmark '${friendlyBenchmarkName}' for group ` +
    `${groupData.groupName} set to ${newStatus}.`;
  await logIncidentAction({
    customerId,
    incidentId: groupData.incidentId,
    eventType: "BENCHMARK_UPDATED",
    details: details,
    metadata: {
      groupId,
      groupName: groupData.groupName,
      benchmark: friendlyBenchmarkName,
      status: newStatus,
    },
  });

  return {message: "Benchmark status updated successfully."};
}

/**
 * Moves multiple units to a new group for a customer.
 * @param {object} query The request query parameters.
 * @param {string} customerId The authenticated customer's ID.
 * @return {Promise<object>} A success message.
 */
async function moveMultipleUnits(query, customerId) {
  const {incidentId, newGroupId, unitIds} = query;
  if (!incidentId || !newGroupId || !unitIds) {
    throw new Error("All parameters are required.");
  }
  await getAndVerifyDoc("incidents", incidentId, customerId);
  await getAndVerifyDoc("groups", newGroupId, customerId);

  const unitIdArray = unitIds.split(",");
  const now = new Date();
  const batch = db.batch();
  const assignmentsRef = db.collection("assignments");

  for (const unitId of unitIdArray) {
    await getAndVerifyDoc("units", unitId, customerId);
    const snapshot = await assignmentsRef
        .where("customerId", "==", customerId)
        .where("incidentId", "==", incidentId)
        .where("unitId", "==", unitId)
        .where("releaseTime", "==", null)
        .limit(1).get();

    if (!snapshot.empty) {
      const oldAssignmentDoc = snapshot.docs[0];
      batch.update(oldAssignmentDoc.ref, {
        releaseTime: now,
        notes: "Moved via multi-unit move",
      });
      const newAssignmentRef = assignmentsRef.doc();
      batch.set(newAssignmentRef, {
        incidentId,
        groupId: newGroupId,
        unitId,
        assignmentTime: now,
        releaseTime: null,
        notes: "Assigned via multi-unit move",
        customerId,
      });
    }
  }

  await batch.commit();
  return {message: `${unitIdArray.length} units moved successfully.`};
}

/**
 * Releases multiple units to be available for a customer.
 * This version adds a critical validation step to ensure that no subunits
 * are being released, protecting data integrity.
 * @param {object} query The request query parameters.
 * @param {string} customerId The authenticated customer's ID.
 * @return {Promise<object>} A success message.
 */
async function releaseMultipleUnits(query, customerId) {
  const {incidentId, unitIds} = query;
  if (!incidentId || !unitIds) {
    throw new Error("Incident and Unit IDs are required.");
  }
  await getAndVerifyDoc("incidents", incidentId, customerId);

  const unitIdArray = unitIds.split(",");
  const now = new Date();
  const batch = db.batch();
  const assignmentsRef = db.collection("assignments");

  // --- THE FIX IS HERE: SERVER-SIDE VALIDATION ---
  // 1. Fetch all the unit documents the user is trying to release.
  const unitsRef = db.collection("units");
  const unitsQuery = unitsRef.where(
      admin.firestore.FieldPath.documentId(), "in", unitIdArray,
  );
  const unitsSnapshot = await unitsQuery.get();

  // 2. Check each unit to ensure it's not a subunit.
  for (const doc of unitsSnapshot.docs) {
    if (doc.data().parentUnitId) {
      // If we find even one subunit, reject the entire request.
      const errorMsg =
        `Cannot release unit ${doc.data().unit}. ` +
        `It is a subunit and must be re-formed first.`;
      throw new functions.https.HttpsError("failed-precondition", errorMsg);
    }
  }
  // --- END OF FIX ---


  // If validation passes, proceed with the original release logic.
  for (const unitId of unitIdArray) {
    const {ref: unitRef} = await getAndVerifyDoc("units", unitId, customerId);
    const snapshot = await assignmentsRef
        .where("customerId", "==", customerId)
        .where("incidentId", "==", incidentId)
        .where("unitId", "==", unitId)
        .where("releaseTime", "==", null)
        .limit(1).get();

    if (!snapshot.empty) {
      batch.update(snapshot.docs[0].ref, {
        releaseTime: now,
        notes: "Released via multi-unit release",
      });
    }
    batch.update(unitRef, {status: "Available"});
  }

  await batch.commit();
  const successMsg = `${unitIdArray.length} units released successfully.`;
  return {message: successMsg};
}


// --- Settings Management ---

/**
 * Fetches the settings for a specific customer.
 * @param {object} query The request query parameters.
 * @param {string} customerId The authenticated customer's ID.
 * @return {Promise<object>} The customer's settings document.
 */
async function getSettings(query, customerId) {
  const settingsRef = db.collection("settings").doc(customerId);
  const doc = await settingsRef.get();
  if (!doc.exists) {
    return {parTimerDurationMinutes: 10}; // Default settings
  }
  return doc.data();
}

/**
 * Updates the settings for a specific customer.
 * @param {object} query The request query parameters.
 * @param {string} customerId The authenticated customer's ID.
 * @return {Promise<object>} A success message.
 */
async function updateSettings(query, customerId) {
  const {parTimerDurationMinutes} = query;
  if (!parTimerDurationMinutes ||
      isNaN(parseInt(parTimerDurationMinutes, 10))) {
    throw new Error("PAR timer duration must be a valid number.");
  }
  const settingsRef = db.collection("settings").doc(customerId);
  await settingsRef.set({
    parTimerDurationMinutes: parseInt(parTimerDurationMinutes, 10),
  }, {merge: true});
  return {message: "Settings updated successfully."};
}

/**
 * Starts the PAR timer for a group and creates a new, active log entry.
 * @param {object} query The request query parameters.
 * @param {string} customerId The authenticated customer's ID.
 * @return {Promise<object>} The updated group data.
 */
async function startParTimer(query, customerId) {
  const {groupId} = query;
  if (!groupId) throw new Error("Group ID is required.");

  // Verify the user owns the group they are trying to modify.
  const {ref: groupRef, data: groupData} =
    await getAndVerifyDoc("groups", groupId, customerId);

  const now = new Date();
  const batch = db.batch();

  // 1. Update the group document for the live UI state.
  const groupUpdateData = {
    parStatus: "Active",
    parStartTime: now,
  };
  batch.update(groupRef, groupUpdateData);

  // 2. Create a new log document in the parLogs collection.
  const newLogRef = db.collection("parLogs").doc();
  batch.set(newLogRef, {
    customerId,
    incidentId: groupData.incidentId,
    groupId: groupId,
    groupName: groupData.groupName, // Denormalize for easier reporting
    parStartTime: now,
    parAckTime: null, // Acknowledgment time is not yet known
    durationSeconds: null,
    status: "Active", // Mark this log as the currently active one
  });

  await batch.commit();

  return {
    ...groupUpdateData,
    parStartTime: now.toISOString(),
  };
}

/**
 * Stops the PAR timer on a group, finds the active log, and updates it
 * with the acknowledgment time and duration.
 * @param {object} query The request query parameters.
 * @param {string} query.groupId The ID of the group to stop the timer for.
 * @param {string} customerId The authenticated customer's ID.
 * @return {Promise<object>} A success message.
 */
async function stopParTimer(query, customerId) {
  const {groupId} = query;
  if (!groupId) {
    throw new Error("Group ID is required.");
  }

  // We only need the 'ref' from this call, not the 'data', so we only
  // destructure what is necessary to avoid unused variable errors.
  const {ref: groupRef} =
    await getAndVerifyDoc("groups", groupId, customerId);

  const now = new Date();
  const batch = db.batch();

  // 1. Update the group document to reset the live UI state.
  batch.update(groupRef, {
    parStatus: "Idle",
    parStartTime: null,
  });

  // 2. Find the active log entry for this group to update it.
  const logQuery = db.collection("parLogs")
      .where("customerId", "==", customerId)
      .where("groupId", "==", groupId)
      .where("status", "==", "Active")
      .limit(1);

  const logSnapshot = await logQuery.get();

  if (!logSnapshot.empty) {
    const activeLogDoc = logSnapshot.docs[0];
    const startTime = activeLogDoc.data().parStartTime.toDate();
    const durationMs = now.getTime() - startTime.getTime();
    const durationSeconds = Math.round(durationMs / 1000);

    // 3. Update the log with the acknowledgment time and final status.
    batch.update(activeLogDoc.ref, {
      parAckTime: now,
      durationSeconds: durationSeconds,
      status: "Acknowledged",
    });
  } else {
    // This can happen if PAR was started before logging feature was added.
    // It's safe to just log a warning and continue.
    const warnMsg = `Could not find an active PAR log for group ID: ${groupId}`;
    console.warn(warnMsg);
  }

  await batch.commit();
  return {message: "PAR timer stopped and logged successfully."};
}

/**
 * Fetches all split-off subunits for a given incident.
 * This version uses a more robust query to find both old and new subunits.
 * @param {object} query The request query parameters.
 * @param {string} customerId The authenticated customer's ID.
 * @return {Promise<Array<object>>} A list of subunit documents.
 */
async function getSplitUnitsForIncident(query, customerId) {
  const {incidentId} = query;
  if (!incidentId) throw new Error("Incident ID is required.");
  await getAndVerifyDoc("incidents", incidentId, customerId);

  // --- THIS IS THE CORRECTED QUERY ---
  // Instead of checking for splitStatus, we now check for the existence
  // of a parentUnitId. This will correctly find subunits created with
  // both the old and new code.
  const snapshot = await db.collection("units")
      .where("customerId", "==", customerId)
      .where("parentUnitId", "!=", null)
      .get();
  // --- END OF CORRECTED QUERY ---

  if (snapshot.empty) return [];
  return snapshot.docs.map((doc) => ({id: doc.id, ...doc.data()}));
}

/**
 * Splits a single unit into two subunits.
 * This version uses a resilient check for old data.
 * @param {object} query The request query parameters.
 * @param {string} customerId The authenticated customer's ID.
 * @return {Promise<object>} A success message.
 */
async function splitUnit(query, customerId) {
  const {unitId, groupId, incidentId} = query;
  if (!unitId || !groupId || !incidentId) {
    throw new Error("Unit, Group, and Incident IDs are required.");
  }

  const {ref: originalUnitRef, data: originalUnitData} =
    await getAndVerifyDoc("units", unitId, customerId);

  // --- START: THIS IS THE CORRECTED VALIDATION ---
  // We now treat a missing splitStatus as "Original" for the check.
  if (
    originalUnitData.isSplit ||
    (originalUnitData.splitStatus ?? "Original") !== "Original"
  ) {
    throw new Error("This unit cannot be split.");
  }
  // --- END: THIS IS THE CORRECTED VALIDATION ---

  const now = new Date();
  const batch = db.batch();

  // 1. Mark original unit as split
  batch.update(originalUnitRef, {isSplit: true});

  // 2. Create subunit A
  const subunitAData = {
    ...originalUnitData,
    unit: `${originalUnitData.unit}-A`,
    splitStatus: "Subunit",
    parentUnitId: unitId,
    isSplit: false,
  };
  const subunitARef = db.collection("units").doc();
  batch.set(subunitARef, subunitAData);

  // 3. Create subunit B
  const subunitBData = {
    ...originalUnitData,
    unit: `${originalUnitData.unit}-B`,
    splitStatus: "Subunit",
    parentUnitId: unitId,
    isSplit: false,
  };
  const subunitBRef = db.collection("units").doc();
  batch.set(subunitBRef, subunitBData);

  // 4. End assignment for original unit
  const assignRef = db.collection("assignments");
  const oldAssignSnap = await assignRef.where("unitId", "==", unitId)
      .where("releaseTime", "==", null).limit(1).get();
  if (!oldAssignSnap.empty) {
    batch.update(oldAssignSnap.docs[0].ref, {
      releaseTime: now,
      notes: "Unit split",
    });
  }

  // 5. Create new assignments for subunits
  const assignA = {
    incidentId: incidentId,
    groupId: groupId,
    unitId: subunitARef.id,
    assignmentTime: now,
    releaseTime: null,
    notes: "Split from parent",
    customerId: customerId,
  };
  batch.set(assignRef.doc(), assignA);

  const assignB = {
    incidentId: incidentId,
    groupId: groupId,
    unitId: subunitBRef.id,
    assignmentTime: now,
    releaseTime: null,
    notes: "Split from parent",
    customerId: customerId,
  };
  batch.set(assignRef.doc(), assignB);

  // 6. Log the action
  const logRef = db.collection("unitActionLogs").doc();
  const part1 = `Split into ${subunitAData.unit}`;
  const logDetails = `${part1} and ${subunitBData.unit}`;
  batch.set(logRef, {
    customerId: customerId,
    incidentId: incidentId,
    unitId: unitId,
    action: "split",
    timestamp: now,
    details: logDetails,
  });

  await batch.commit();

  return {message: "Unit split successfully."};
}

/**
 * Reforms a split unit, removing subunits and reassigning the original.
 * @param {object} query The request query parameters.
 * @param {string} customerId The authenticated customer's ID.
 * @return {Promise<object>} A success message.
 */
async function unsplitUnit(query, customerId) {
  const {parentUnitId, newGroupId, incidentId} = query;
  if (!parentUnitId || !newGroupId || !incidentId) {
    throw new Error("Parent Unit, New Group, and Incident IDs are required.");
  }

  const {ref: parentUnitRef} = await getAndVerifyDoc(
      "units",
      parentUnitId,
      customerId,
  );
  const now = new Date();
  const batch = db.batch();

  // 1. Find and delete subunits
  const subunitsSnap = await db.collection("units")
      .where("parentUnitId", "==", parentUnitId).get();
  const subunitIds = [];
  subunitsSnap.forEach((doc) => {
    subunitIds.push(doc.id);
    batch.delete(doc.ref);
  });

  // 2. End assignments for the subunits
  if (subunitIds.length > 0) {
    const assignSnap = await db.collection("assignments")
        .where("unitId", "in", subunitIds)
        .where("releaseTime", "==", null).get();
    assignSnap.forEach((doc) => {
      batch.update(doc.ref, {releaseTime: now, notes: "Unit reformed"});
    });
  }

  // 3. Un-mark the parent unit and make it available
  batch.update(parentUnitRef, {isSplit: false, status: "Available"});

  // 4. Create new assignment for the parent unit in the selected group
  const newAssignRef = db.collection("assignments").doc();
  // Corrected indentation, spacing, and trailing comma on this block
  batch.set(newAssignRef, {
    incidentId,
    groupId: newGroupId,
    unitId: parentUnitId,
    assignmentTime: now,
    releaseTime: null,
    notes: "Reformed from subunits",
    customerId,
  });
  batch.update(parentUnitRef, {status: "Assigned"}); // Re-assign parent

  // 5. Log the action
  const logRef = db.collection("unitActionLogs").doc();
  batch.set(logRef, {
    customerId,
    incidentId,
    unitId: parentUnitId,
    action: "unsplit",
    timestamp: now,
    details: "Reformed unit",
  });

  await batch.commit();
  return {message: "Unit reformed successfully."};
}

/**
 * Splits multiple units into subunits.
 * This version uses a resilient check for old data.
 * @param {object} query The request query parameters.
 * @param {string} customerId The authenticated customer's ID.
 * @return {Promise<object>} A success message.
 */
async function splitMultipleUnits(query, customerId) {
  const {unitIds, groupId, incidentId} = query;
  if (!unitIds || !groupId || !incidentId) {
    throw new Error("Unit, Group, and Incident IDs are required.");
  }

  const unitIdArray = unitIds.split(",");
  const now = new Date();
  const batch = db.batch();

  for (const unitId of unitIdArray) {
    const {ref: originalUnitRef, data: originalUnitData} =
      await getAndVerifyDoc("units", unitId, customerId);

    // --- START: THIS IS THE CORRECTED VALIDATION ---
    if (
      originalUnitData.isSplit ||
      (originalUnitData.splitStatus ?? "Original") !== "Original"
    ) {
      console.warn(`Unit ${unitId} cannot be split. Skipping.`);
      continue;
    }
    // --- END: THIS IS THE CORRECTED VALIDATION ---

    // 1. Mark original unit as split
    batch.update(originalUnitRef, {isSplit: true});

    // 2. Create subunits
    const subunitAData = {
      ...originalUnitData,
      unit: `${originalUnitData.unit}-A`,
      splitStatus: "Subunit",
      parentUnitId: unitId,
      isSplit: false,
    };
    const subunitARef = db.collection("units").doc();
    batch.set(subunitARef, subunitAData);

    const subunitBData = {
      ...originalUnitData,
      unit: `${originalUnitData.unit}-B`,
      splitStatus: "Subunit",
      parentUnitId: unitId,
      isSplit: false,
    };
    const subunitBRef = db.collection("units").doc();
    batch.set(subunitBRef, subunitBData);

    // 3. End assignment for original unit
    const assignRef = db.collection("assignments");
    const oldAssignSnap = await assignRef.where("unitId", "==", unitId)
        .where("releaseTime", "==", null).limit(1).get();
    if (!oldAssignSnap.empty) {
      batch.update(oldAssignSnap.docs[0].ref, {
        releaseTime: now,
        notes: "Unit split",
      });
    }

    // 4. Create new assignments for subunits
    const assignA = {
      incidentId: incidentId,
      groupId: groupId,
      unitId: subunitARef.id,
      assignmentTime: now,
      releaseTime: null,
      notes: "Split from parent",
      customerId: customerId,
    };
    batch.set(assignRef.doc(), assignA);
    const assignB = {
      incidentId: incidentId,
      groupId: groupId,
      unitId: subunitBRef.id,
      assignmentTime: now,
      releaseTime: null,
      notes: "Split from parent",
      customerId: customerId,
    };
    batch.set(assignRef.doc(), assignB);

    // 5. Log the action
    const logRef = db.collection("unitActionLogs").doc();
    const part1 = `Split into ${subunitAData.unit}`;
    const logDetails = `${part1} and ${subunitBData.unit}`;
    batch.set(logRef, {
      customerId: customerId,
      incidentId: incidentId,
      unitId: unitId,
      action: "split",
      timestamp: now,
      details: logDetails,
    });
  }

  await batch.commit();
  return {message: "Selected units split successfully."};
}

/**
 * Updates the displayOrder for a list of groups in a single transaction.
 * @param {object} query The request query parameters.
 * @param {string} customerId The authenticated customer's ID.
 * @return {Promise<object>} A success message.
 */
async function updateGroupOrder(query, customerId) {
  const {incidentId, groupIds} = query;
  if (!incidentId || !groupIds) {
    const errorMessage =
      "Incident ID and an ordered list of Group IDs are required.";
    throw new Error(errorMessage);
  }

  // First, verify the user has permission to modify this incident.
  await getAndVerifyDoc("incidents", incidentId, customerId);

  const groupIdArray = groupIds.split(",");
  const batch = db.batch();

  // Loop through the received IDs, using their new index as the displayOrder.
  groupIdArray.forEach((groupId, index) => {
    // We trust the front-end has sent valid IDs for this incident. A full
    // implementation might re-verify each group ID belongs to the customer.
    const groupRef = db.collection("groups").doc(groupId);
    batch.update(groupRef, {displayOrder: index});
  });

  await batch.commit();

  const successMessage =
    `Group order updated for ${groupIdArray.length} groups.`;
  return {message: successMessage};
}

/**
 * Sets the parent for a given group.
 * @param {object} query The request query parameters.
 * @param {string} customerId The authenticated customer's ID.
 * @return {Promise<object>} A success message.
 */
async function setGroupParent(query, customerId) {
  const {incidentId, childGroupId, parentGroupId} = query;
  if (!incidentId || !childGroupId || !parentGroupId) {
    const errorMessage =
      "Incident, Child Group, and Parent Group IDs are required.";
    throw new Error(errorMessage);
  }

  // Verify ownership of all related documents
  await getAndVerifyDoc("incidents", incidentId, customerId);
  const {ref: childRef} = await getAndVerifyDoc(
      "groups", childGroupId, customerId);
  await getAndVerifyDoc("groups", parentGroupId, customerId);

  // Update the child document with the parent's ID
  await childRef.update({parentGroupId: parentGroupId});

  return {message: "Group parent assigned successfully."};
}

/**
 * Clears the parent from a given group, making it a top-level group.
 * @param {object} query The request query parameters.
 * @param {string} customerId The authenticated customer's ID.
 * @return {Promise<object>} A success message.
 */
async function clearGroupParent(query, customerId) {
  const {incidentId, childGroupId} = query;
  if (!incidentId || !childGroupId) {
    throw new Error("Incident and Child Group IDs are required.");
  }

  // Verify ownership
  await getAndVerifyDoc("incidents", incidentId, customerId);
  const {ref: childRef} = await getAndVerifyDoc(
      "groups", childGroupId, customerId);

  // Update the child, setting the parent to null
  await childRef.update({parentGroupId: null});

  return {message: "Group parent cleared successfully."};
}

/**
 * Disbands a group from an incident after verifying it is empty and not a
 * parent. This action is non-destructive; it marks the group as
 * "Disbanded" and creates a log entry instead of deleting the document.
 * @param {object} query The request query parameters.
 * @param {string} customerId The authenticated customer's ID.
 * @return {Promise<object>} A success message.
 */
async function disbandGroup(query, customerId) {
  const {groupId, incidentId} = query;
  if (!groupId || !incidentId) {
    throw new Error("Group ID and Incident ID are required.");
  }

  // First, verify ownership of the group and incident.
  const {ref: groupRef, data: groupData} =
    await getAndVerifyDoc("groups", groupId, customerId);
  await getAndVerifyDoc("incidents", incidentId, customerId);

  // --- VALIDATION CHECKS ---
  // 1. Check for assigned units in this group.
  const assignmentsSnap = await db.collection("assignments")
      .where("customerId", "==", customerId)
      .where("groupId", "==", groupId)
      .where("releaseTime", "==", null)
      .limit(1)
      .get();
  if (!assignmentsSnap.empty) {
    throw new Error("Cannot disband group. Reassign all units first.");
  }

  // 2. Check if this group is a parent to any other groups.
  const childrenSnap = await db.collection("groups")
      .where("customerId", "==", customerId)
      .where("parentGroupId", "==", groupId)
      .limit(1)
      .get();
  if (!childrenSnap.empty) {
    const errorMsg = "Cannot disband group. It is a parent to other groups.";
    throw new Error(errorMsg);
  }
  // --- END: VALIDATION CHECKS ---

  // Instead of deleting, we now update the status.
  await groupRef.update({
    status: "Disbanded",
    disbandTime: new Date(),
  });

  // Create a permanent log of the disband action.
  const details = "Group " + groupData.groupName + " was disbanded.";
  await logIncidentAction({
    customerId,
    incidentId,
    eventType: "GROUP_DISBANDED",
    details: details,
    metadata: {groupId, groupName: groupData.groupName},
  });

  return {message: "Group disbanded successfully."};
}

/**
 * Deletes an incident and all of its associated data after verifying admin
 * authorization and ensuring the incident is closed.
 * @param {object} query The request query parameters.
 * @param {object} authContext The full authorization context.
 * @return {Promise<object>} A success message.
 */
async function deleteIncident(query, authContext) {
  const {incidentId, adminCode} = query;
  if (!incidentId || !adminCode) {
    throw new Error("Incident ID and Admin Code are required.");
  }

  // Use the secure UID from the token to look up the user's profile.
  const userRef = db.collection("users").doc(authContext.uid);
  const userDoc = await userRef.get();

  if (!userDoc.exists || userDoc.data().adminCode !== adminCode) {
    throw new functions.https.HttpsError(
        "permission-denied", "Invalid Admin Code.",
    );
  }

  // Verify the incident belongs to the customer and is closed.
  const {ref: incidentRef, data: incidentData} =
    await getAndVerifyDoc("incidents", incidentId, authContext.customerId);
  if (incidentData.status !== "Closed") {
    // --- THE FIX IS HERE ---
    const errorMsg =
      "Cannot delete an active incident. It must be closed first.";
    throw new Error(errorMsg);
    // --- END OF FIX ---
  }

  // Prepare a batch to delete all associated data.
  const batch = db.batch();
  const collectionsToDeleteFrom = [
    "groups", "assignments", "parLogs", "unitActionLogs",
  ];
  for (const collectionName of collectionsToDeleteFrom) {
    const snapshot = await db.collection(collectionName)
        .where("incidentId", "==", incidentId)
        .where("customerId", "==", authContext.customerId)
        .get();
    if (!snapshot.empty) {
      snapshot.forEach((doc) => batch.delete(doc.ref));
    }
  }

  batch.delete(incidentRef);
  await batch.commit();

  const successMsg = "Incident and all associated data deleted successfully.";
  return {message: successMsg};
}

// ===================================================================
//
//  USER MANAGEMENT (ADMIN ONLY)
//
// ===================================================================

/**
 * A secure helper to verify that the caller is the designated Super Admin.
 * @param {object} authContext The context object from a callable function.
 * @throws {Error} If the caller is not the Super Admin.
 */
function verifySuperAdmin(authContext) {
  if (authContext.auth.token.isSuperAdmin !== true) {
    const errorMsg =
      "You must be a Super Admin to perform this action.";
    throw new functions.https.HttpsError(
        "permission-denied",
        errorMsg,
    );
  }
}

/**
 * An API action to fetch all users from Firebase Auth and Firestore.
 * @param {object} query The request query parameters (empty).
 * @param {object} authContext The authorization context of the caller.
 * @return {Promise<Array<object>>} A list of all users with merged data.
 */
async function getAllUsers(query, authContext) {
  verifySuperAdmin(authContext);

  try {
    const listUsersResult = await admin.auth().listUsers(1000);
    const allFirestoreUsers = await db.collection("users").get();

    const firestoreUserMap = new Map();
    allFirestoreUsers.forEach((doc) => {
      firestoreUserMap.set(doc.id, doc.data());
    });

    const combinedUsers = listUsersResult.users.map((userRecord) => {
      const firestoreProfile = firestoreUserMap.get(userRecord.uid) || {};
      return {
        uid: userRecord.uid,
        email: userRecord.email,
        disabled: userRecord.disabled,
        creationTime: userRecord.metadata.creationTime,
        lastSignInTime: userRecord.metadata.lastSignInTime,
        ...firestoreProfile,
      };
    });

    return combinedUsers;
  } catch (error) {
    console.error("Error fetching all users:", error);
    const errorMsg = "Failed to fetch user list.";
    throw new functions.https.HttpsError("internal", errorMsg);
  }
}

/**
 * An API action to allow a Super Admin to set a new password for any user.
 * @param {object} query The request query parameters.
 * @param {string} query.targetUid The UID of the user to update.
 * @param {string} query.newPassword The new password to set.
 * @param {object} authContext The authorization context of the caller.
 * @return {Promise<object>} A success message.
 */
async function setNewPasswordForUser(query, authContext) {
  verifySuperAdmin(authContext);
  const {targetUid, newPassword} = query;
  const passTooShort = !newPassword || newPassword.length < 6;
  if (!targetUid || passTooShort) {
    const errorMsg =
      "UID and a password of at least 6 characters are required.";
    throw new functions.https.HttpsError("invalid-argument", errorMsg);
  }
  try {
    await admin.auth().updateUser(targetUid, {password: newPassword});
    const successMsg = `Password updated for UID: ${targetUid}`;
    return {success: true, message: successMsg};
  } catch (error) {
    console.error("Failed to update password:", error);
    const errorMsg = "Could not update password.";
    throw new functions.https.HttpsError("internal", errorMsg);
  }
}

/**
 * An API action for a Super Admin to revoke all active refresh tokens for
 * a user, forcing them to log in again on all devices.
 * @param {object} query The request query parameters.
 * @param {string} query.targetUid The UID of the user to sign out.
 * @param {object} authContext The authorization context of the caller.
 * @return {Promise<object>} A success message.
 */
async function revokeUserSessions(query, authContext) {
  verifySuperAdmin(authContext);
  const {targetUid} = query;
  if (!targetUid) {
    throw new functions.https.HttpsError(
        "invalid-argument", "A target UID is required.",
    );
  }
  try {
    await admin.auth().revokeRefreshTokens(targetUid);
    const userProfileRef = db.collection("users").doc(targetUid);
    await userProfileRef.update({
      tokensValidAfterTime: new Date(),
    });
    const successMsg =
      `Successfully revoked all sessions for user UID: ${targetUid}.`;
    console.log(successMsg);
    return {success: true, message: successMsg};
  } catch (error) {
    console.error("Failed to revoke refresh tokens:", error);
    const errorMsg = "Could not revoke user sessions.";
    throw new functions.https.HttpsError("internal", errorMsg);
  }
}

/**
 * A scheduled function (v2) that runs periodically to clean up abandoned
 * command sessions. This "smart" cleanup only removes stale sessions that are
 * actively holding a command lock on an incident. This releases the lock and
 * prevents user lockouts. Standby sessions are left alone.
 */
exports.cleanupstalecommandsessions = onSchedule(
    "every 1 hours", async (event) => {
      console.log("Running stale command session cleanup...");
      const now = new Date();
      // A session is considered stale if not sending a heartbeat for 2 hours.
      const twoHoursAgo = 2 * 60 * 60 * 1000;
      const staleThreshold = new Date(now.getTime() - twoHoursAgo);

      const sessionsRef = db.collection("sessions");
      const staleSessionsQuery = sessionsRef
          .where("lastActive", "<", staleThreshold);
      const staleSessionsSnapshot = await staleSessionsQuery.get();

      if (staleSessionsSnapshot.empty) {
        console.log("No stale sessions found. Cleanup complete.");
        return null;
      }

      const staleSessionIds = staleSessionsSnapshot.docs.map((doc) => doc.id);
      const investigationMsg =
        `Found ${staleSessionIds.length} stale sessions to investigate.`;
      console.log(investigationMsg);

      const incidentsRef = db.collection("incidents");
      const lockedIncidentsQuery = incidentsRef
          .where("status", "==", "Active")
          .where("commanderSessionId", "in", staleSessionIds);

      const lockedIncidentsSnapshot = await lockedIncidentsQuery.get();

      if (lockedIncidentsSnapshot.empty) {
        const noActionMsg =
          "No incidents are locked by stale sessions. No action needed.";
        console.log(noActionMsg);
        return null;
      }

      const batch = db.batch();
      const sessionsToDelete = new Set();

      lockedIncidentsSnapshot.forEach((doc) => {
        const incident = doc.data();
        const releaseMsg = `Incident ${doc.id} is locked by stale session ` +
                           `${incident.commanderSessionId}. Releasing lock.`;
        console.log(releaseMsg);

        batch.update(doc.ref, {
          commanderUid: null,
          commanderSessionId: null,
        });

        sessionsToDelete.add(incident.commanderSessionId);
      });

      sessionsToDelete.forEach((sessionId) => {
        console.log(`Deleting stale session document: ${sessionId}`);
        const sessionRef = sessionsRef.doc(sessionId);
        batch.delete(sessionRef);
      });

      await batch.commit();

      const successMsg = "Released locks on " +
        `${lockedIncidentsSnapshot.size} incidents and deleted ` +
        `${sessionsToDelete.size} sessions.`;
      console.log(successMsg);
      return null;
    });

/**
 * A scheduled function (v2) that runs daily as a "janitor" to clean up
 * any session documents that are very old and truly abandoned, regardless
 * of their command status. This is for long-term database hygiene.
 */
exports.cleanupoldsessions = onSchedule(
    // Runs once a day at a quiet time, like 3:00 AM server time.
    "every day 03:00", async (event) => {
      console.log("Running daily old session cleanup job...");

      const now = new Date();
      // A session is considered "old" if it hasn't been active in 60 days.
      // This is a very safe threshold.
      const sixtyDaysInMs = 60 * 24 * 60 * 60 * 1000;
      const oldThreshold = new Date(now.getTime() - sixtyDaysInMs);

      const sessionsRef = db.collection("sessions");
      const oldSessionsQuery = sessionsRef
          .where("lastActive", "<", oldThreshold)
          .limit(400); // Limit to 400 deletes per run to stay within limits.

      const snapshot = await oldSessionsQuery.get();

      if (snapshot.empty) {
        console.log("No old sessions found to delete. Job complete.");
        return null;
      }

      console.log(`Found ${snapshot.size} old sessions to delete.`);

      const batch = db.batch();
      snapshot.forEach((doc) => {
        batch.delete(doc.ref);
      });

      await batch.commit();

      const successMsg = "Successfully deleted " +
        `${snapshot.size} old session documents.`;
      console.log(successMsg);
      return null;
    });
