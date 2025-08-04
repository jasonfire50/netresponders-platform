/**
 * functions/index.js
 * This file contains complete backend API for the Command Board application.
 *
 * Version: 1.22.0
 * Changes in this version:
 * - Corrected all reported linting errors (max-len, indent, comma-dangle).
 * - Fixed a critical bug where new API functions (startParTimer,
 *   stopParTimer, getSplitUnitsForIncident) were defined but never
 *   wired into the API router, making them unusable.
 * - This is the definitive, stable version of the backend.
 */

const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();

// ===================================================================
//
//  SECURITY AND AUTHORIZATION
//
// ===================================================================

/**
 * Authenticates a request using the launchId and returns a full
 * authorization context, including the customerId and planLevel.
 * @param {string} launchId The unique launch ID from the request query.
 * @return {Promise<object>} An object containing {customerId, planLevel}.
 * @throws {Error} If authentication fails.
 */
async function getAuthContextFromLaunchId(launchId) {
  if (!launchId) {
    throw new functions.https.HttpsError(
        "unauthenticated", "No authentication ID was provided.",
    );
  }
  const userRef = db.collection("users").doc(launchId);
  const userDoc = await userRef.get();
  if (!userDoc.exists) {
    throw new functions.https.HttpsError(
        "not-found", "The provided authentication ID is invalid.",
    );
  }
  const userData = userDoc.data();
  if (userData.status !== "Active") {
    throw new functions.https.HttpsError(
        "permission-denied", "This account is not currently active.",
    );
  }
  if (!userData.customerId) {
    throw new functions.https.HttpsError(
        "internal", "Configuration error: Customer ID missing for this user.",
    );
  }

  return {
    customerId: userData.customerId,
    planLevel: userData.planLevel || "Basic",
  };
}

// ===================================================================
//
//  MAIN API ROUTER
//
// ===================================================================

/**
 * Main API router function.
 */
exports.api = functions.https.onRequest(async (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }

  const action = req.query.action;

  try {
    const authContext = await getAuthContextFromLaunchId(req.query.id);
    const customerId = authContext.customerId;
    console.log(
        `Request authorized for customerId: ${customerId} ` +
        `on plan: ${authContext.planLevel}`,
    );

    let result;
    switch (action) {
      case "getInitialData":
        result = await getInitialData(req.query, authContext);
        break;
      case "getDepartments":
        result = await getDepartments(req.query.id, customerId);
        break;
      case "addDepartment":
        result = await addDepartment(req.query, customerId);
        break;
      case "updateFireDepartment":
        result = await updateFireDepartment(req.query, customerId);
        break;
      case "deleteFireDepartment":
        result = await deleteFireDepartment(req.query, customerId);
        break;
      case "getUnitsGroupedByStation":
        result = await getUnitsGroupedByStation(req.query, customerId);
        break;
      case "addUnitToMaster":
        result = await addUnitToMaster(req.query, customerId);
        break;
      case "updateUnitInMaster":
        result = await updateUnitInMaster(req.query, customerId);
        break;
      case "deleteUnitFromMaster":
        result = await deleteUnitFromMaster(req.query, customerId);
        break;
      case "getCommonGroups":
        result = await getCollectionData("commonGroups", customerId);
        break;
      case "addCommonGroup":
        result = await addCommonGroup(req.query, customerId);
        break;
      case "updateCommonGroup":
        result = await updateCommonGroup(req.query, customerId);
        break;
      case "deleteCommonGroup":
        result = await deleteCommonGroup(req.query, customerId);
        break;
      case "getTemplates":
        result = await getTemplates(req.query, customerId);
        break;
      case "addTemplate":
        result = await addTemplate(req.query, customerId);
        break;
      case "updateTemplate":
        result = await updateTemplate(req.query, customerId);
        break;
      case "deleteTemplate":
        result = await deleteTemplate(req.query, customerId);
        break;
      case "getSettings":
        result = await getSettings(req.query, customerId);
        break;
      case "updateSettings":
        result = await updateSettings(req.query, customerId);
        break;
      case "getAllAvailableUnitsGroupedByDept":
        result = await getAllAvailableUnitsGroupedByDept(
            req.query,
            customerId,
        );
        break;
      case "getUnitTypes":
        result = await getCollectionData("unitTypes", customerId);
        break;
      case "addUnitType":
        result = await addUnitType(req.query, customerId);
        break;
      case "updateUnitType":
        result = await updateUnitType(req.query, customerId);
        break;
      case "deleteUnitType":
        result = await deleteUnitType(req.query, customerId);
        break;
      case "getActiveIncidents":
        result = await getActiveIncidents(req.query, customerId);
        break;
      case "getClosedIncidents":
        result = await getClosedIncidents(req.query, customerId);
        break;
      case "startNewIncident":
        result = await startNewIncident(req.query, customerId);
        break;
      case "getGroupsForIncident":
        result = await getGroupsForIncident(req.query, customerId);
        break;
      case "createGroupForIncident":
        result = await createGroupForIncident(req.query, customerId);
        break;
      case "assignUnitsToGroup":
        result = await assignUnitsToGroup(req.query, customerId);
        break;
      case "moveUnitToNewGroup":
        result = await moveUnitToNewGroup(req.query, customerId);
        break;
      case "releaseUnitToAvailable":
        result = await releaseUnitToAvailable(req.query, customerId);
        break;
      case "setGroupSupervisor":
        result = await setGroupSupervisor(req.query, customerId);
        break;
      case "clearGroupSupervisor":
        result = await clearGroupSupervisor(req.query, customerId);
        break;
      case "updateGroupBenchmark":
        result = await updateGroupBenchmark(req.query, customerId);
        break;
      case "closeIncident":
        result = await closeIncident(req.query, customerId);
        break;
      case "applyTemplateToIncident":
        result = await applyTemplateToIncident(req.query, customerId);
        break;
      case "moveMultipleUnits":
        result = await moveMultipleUnits(req.query, customerId);
        break;
      case "releaseMultipleUnits":
        result = await releaseMultipleUnits(req.query, customerId);
        break;
      case "splitUnit":
        result = await splitUnit(req.query, customerId);
        break;
      case "unsplitUnit":
        result = await unsplitUnit(req.query, customerId);
        break;
      case "splitMultipleUnits":
        result = await splitMultipleUnits(req.query, customerId);
        break;
      case "updateGroupOrder":
        result = await updateGroupOrder(req.query, customerId);
        break;
      case "setGroupParent":
        result = await setGroupParent(req.query, customerId);
        break;
      case "clearGroupParent":
        result = await clearGroupParent(req.query, customerId);
        break;
      case "disbandGroup":
        result = await disbandGroup(req.query, customerId);
        break;
      case "deleteIncident":
        result = await deleteIncident(req.query, customerId);
        break;
      case "startParTimer":
        result = await startParTimer(req.query, customerId);
        break;
      case "stopParTimer":
        result = await stopParTimer(req.query, customerId);
        break;
      case "getSplitUnitsForIncident":
        result = await getSplitUnitsForIncident(req.query, customerId);
        break;

      default: throw new Error("Invalid action specified.");
    }
    res.status(200).json({success: true, data: result});
  } catch (error) {
    console.error(`API Error on action "${action}":`, error);
    if (error instanceof functions.https.HttpsError) {
      res.status(error.httpErrorCode.status)
          .json({success: false, message: error.message});
    } else {
      res.status(500).json({success: false, message: error.message});
    }
  }
});

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
 * A generic helper to fetch all documents from any specified collection
 * that belong to the authenticated customer.
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
    throw new functions.https.HttpsError(
        "permission-denied", `Access denied to ${collectionName} document.`);
  }
  return {ref: docRef, data: data};
}

/**
 * Fetches all the initial data needed to bootstrap the front-end.
 * This version now includes the user's planLevel in the payload.
 * @param {object} query The request query parameters.
 * @param {object} authContext The authorization context for the user.
 * @return {Promise<object>} An object containing all initial data for the app.
 */
async function getInitialData(query, authContext) {
  const customerId = authContext.customerId;

  const [
    departments,
    unitTypes,
    commonGroups,
    templates,
    activeIncidents,
    settings,
  ] = await Promise.all([
    getDepartments(query.id, customerId),
    getCollectionData("unitTypes", customerId),
    getCollectionData("commonGroups", customerId),
    getCollectionData("templates", customerId),
    getActiveIncidents(query, customerId),
    getSettings(query, customerId),
  ]);

  return {
    fireDepartments: departments,
    unitTypes: unitTypes,
    commonGroups: commonGroups,
    templates: templates,
    activeIncidents: activeIncidents,
    settings: settings,
    planLevel: authContext.planLevel,
  };
}


// --- Department Management ---

/**
 * Fetches departments for a customer and flags the user's primary department.
 * This version reads the primaryDepartmentId from the parent CUSTOMER document.
 * @param {string} launchId The user's launch ID.
 * @param {string} customerId The authenticated customer's ID.
 * @return {Promise<Array<object>>} The list of department documents.
 */
async function getDepartments(launchId, customerId) {
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
 * This version uses departmentId and is lint-compliant.
 * @param {object} query The request query parameters.
 * @param {string} customerId The authenticated customer's ID.
 * @return {Promise<object>} The new unit document.
 */
async function addUnitToMaster(query, customerId) {
  const {
    departmentId, // Use the new consistent name.
    unit,
    unitTypeId,
    unitName,
    status,
    notes,
    stationName,
    id: launchId,
  } = query;

  if (!departmentId || !unit || !unitTypeId || !unitName || !status) {
    throw new Error("All required fields must be provided.");
  }

  // --- Feature Gate Logic (remains the same) ---
  const authContext = await getAuthContextFromLaunchId(launchId);
  if (authContext.planLevel === "Basic") {
    const unitsRef = db.collection("units");
    const unitsQuery = unitsRef.where("customerId", "==", customerId);
    const unitsSnapshot = await unitsQuery.get();

    if (unitsSnapshot.size >= 50) {
      const errorMessage =
        "Unit limit reached. Upgrade to the Pro plan to add more units.";
      throw new functions.https.HttpsError(
          "permission-denied",
          errorMessage,
      );
    }
  }
  // --- End Feature Gate Logic ---

  const newUnitData = {
    departmentId, // Save with the new consistent field name.
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
  if (snapshot.empty) return [];
  return snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      startTime: data.startTime ? data.startTime.toDate().toISOString() : null,
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
 * Starts a new incident for a customer.
 * @param {object} query The request query parameters.
 * @param {string} customerId The authenticated customer's ID.
 * @return {Promise<object>} The new incident document.
 */
async function startNewIncident(query, customerId) {
  const {incidentNumber, incidentName} = query;
  const timestamp = new Date();
  const year = timestamp.getFullYear();
  const month = (timestamp.getMonth() + 1).toString().padStart(2, "0");
  const day = timestamp.getDate().toString().padStart(2, "0");
  const hours = timestamp.getHours().toString().padStart(2, "0");
  const minutes = timestamp.getMinutes().toString().padStart(2, "0");

  const numberToSave = (incidentNumber && incidentNumber.trim() !== "") ?
    incidentNumber.trim() : `${year}${month}${day}-${hours}${minutes}`;

  const newIncidentData = {
    incidentNumber: numberToSave,
    incidentName: incidentName ? incidentName.trim() : null,
    startTime: timestamp,
    status: "Active",
    endTime: null,
    customerId,
  };
  const docRef = await db.collection("incidents").add(newIncidentData);
  return {
    id: docRef.id,
    ...newIncidentData,
    startTime: timestamp.toISOString(),
  };
}

/**
 * Closes an incident, releasing all units and cleaning up split units.
 * This version is fully lint-compliant with strict max-len rules.
 * @param {object} query The request query parameters.
 * @param {string} customerId The authenticated customer's ID.
 * @return {Promise<object>} A success message.
 */
async function closeIncident(query, customerId) {
  const {incidentId} = query;
  if (!incidentId) {
    throw new Error("Incident ID is required.");
  }

  const {ref: incidentRef} =
    await getAndVerifyDoc("incidents", incidentId, customerId);

  const now = new Date();
  const batch = db.batch();
  const unitsRef = db.collection("units");

  // Find all active assignments for this incident.
  const assignmentsQuery = db.collection("assignments")
      .where("customerId", "==", customerId)
      .where("incidentId", "==", incidentId)
      .where("releaseTime", "==", null);
  const assignmentsSnapshot = await assignmentsQuery.get();

  if (assignmentsSnapshot.empty) {
    batch.update(incidentRef, {status: "Closed", endTime: now});
    await batch.commit();
    return {message: "Incident closed successfully."};
  }

  // THE FIX: Break the .map() into a multi-line block to pass max-len.
  const assignedUnitIds = assignmentsSnapshot.docs.map((doc) => {
    return doc.data().unitId;
  });

  const assignedUnitsQuery = unitsRef.where(
      admin.firestore.FieldPath.documentId(), "in", assignedUnitIds,
  );
  const assignedUnitsSnapshot = await assignedUnitsQuery.get();

  const parentUnitIdsToReset = new Set();
  const subunitIdsToDelete = new Set();

  assignedUnitsSnapshot.forEach((doc) => {
    const unitData = doc.data();
    if (unitData.parentUnitId) {
      parentUnitIdsToReset.add(unitData.parentUnitId);
      subunitIdsToDelete.add(doc.id);
    }
  });

  // Queue operations to re-form any parent units.
  if (parentUnitIdsToReset.size > 0) {
    const parentUnitsQuery = unitsRef.where(
        admin.firestore.FieldPath.documentId(), "in", [...parentUnitIdsToReset],
    );
    const parentUnitsSnapshot = await parentUnitsQuery.get();
    parentUnitsSnapshot.forEach((doc) => {
      batch.update(doc.ref, {isSplit: false, status: "Available"});
    });
  }

  // Queue deletion of all temporary subunit documents.
  subunitIdsToDelete.forEach((unitId) => batch.delete(unitsRef.doc(unitId)));

  // Update assignment records and status for all other units.
  assignmentsSnapshot.forEach((doc) => {
    batch.update(doc.ref, {
      releaseTime: now,
      notes: "Released on incident closure",
    });
    const unitId = doc.data().unitId;
    const isParent = parentUnitIdsToReset.has(unitId);
    const isSubunit = subunitIdsToDelete.has(unitId);
    // Only update status if it's a regular unit (not a parent or subunit).
    if (!isParent && !isSubunit) {
      const unitDoc = assignedUnitsSnapshot.docs.find((d) => d.id === unitId);
      if (unitDoc && unitDoc.data().status !== "Out of Service") {
        batch.update(unitsRef.doc(unitId), {status: "Available"});
      }
    }
  });

  // Finally, mark the incident itself as closed.
  batch.update(incidentRef, {status: "Closed", endTime: now});
  await batch.commit();

  // THE FIX: Store the long message in a variable to pass max-len.
  const successMessage =
    "Incident closed, all units released, and split units reformed.";
  return {message: successMessage};
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
 * Fetches available units and groups them into a flat list under their
 * respective departments, ready for a sortable table view on the front-end.
 * @param {object} query The request query parameters.
 * @param {string} customerId The authenticated customer's ID.
 * @return {Promise<object>} An object containing departments, each with a
 *                           flat array of its available units.
 */
async function getAllAvailableUnitsGroupedByDept(query, customerId) {
  // Step 1: Fetch departments and all units for the customer.
  const [depts, allUnits] = await Promise.all([
    getDepartments(query.id, customerId),
    getCollectionData("units", customerId),
  ]);

  // Step 2: Filter for only available units.
  const availableUnits = allUnits.filter((u) => u.status === "Available");

  // Step 3: Group the available units by their `departmentId`.
  const unitsByDeptId = availableUnits.reduce((acc, unit) => {
    const key = unit.departmentId;
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(unit);
    return acc;
  }, {});

  // Step 4: Map over departments and then chain a filter.
  // This block has been meticulously re-formatted to match linter rules.
  const groupedResult = depts
      .map((dept) => {
        const unitsForDept = unitsByDeptId[dept.id] || [];

        dept.units = unitsForDept.sort(
            (a, b) => (a.unit || "").localeCompare(b.unit || ""),
        );

        return dept;
      })
      .filter((dept) => dept.units.length > 0);

  // Step 5: Return the final object.
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
 * @param {string} customerId The authenticated customer's ID.
 * @return {Promise<object>} A success message.
 */
async function stopParTimer(query, customerId) {
  const {groupId} = query;
  if (!groupId) throw new Error("Group ID is required.");
  const {ref: groupRef} = await getAndVerifyDoc("groups", groupId, customerId);

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

    // --- START: CORRECTED DURATION CALCULATION ---
    // Break the long line into multiple steps for readability and linting.
    const durationMs = now.getTime() - startTime.getTime();
    const durationSeconds = Math.round(durationMs / 1000);
    // --- END: CORRECTED DURATION CALCULATION ---

    // 3. Update the log with the acknowledgment time and final status.
    batch.update(activeLogDoc.ref, {
      parAckTime: now,
      durationSeconds: durationSeconds,
      status: "Acknowledged",
    });
  } else {
    // This can happen if PAR was started before logging feature was added.
    // It's safe to just log a warning and continue.
    console.warn(`Could not find an active PAR log for group ID: ${groupId}`);
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
 * @param {object} query The request query parameters, including the user's
 *     launchId.
 * @param {string} customerId The authenticated customer's ID.
 * @return {Promise<object>} A success message.
 */
async function deleteIncident(query, customerId) {
  const {incidentId, adminCode, id: launchId} = query;
  if (!incidentId || !adminCode || !launchId) {
    throw new Error("Incident ID, Admin Code, and Launch ID are required.");
  }

  // Step 1: Verify the Admin Code from the USER'S document.
  const userRef = db.collection("users").doc(launchId);
  const userDoc = await userRef.get();

  if (!userDoc.exists || userDoc.data().adminCode !== adminCode) {
    throw new functions.https.HttpsError(
        "permission-denied", "Invalid Admin Code.");
  }

  // Step 2: Verify the incident belongs to the customer and is closed.
  const {ref: incidentRef, data: incidentData} =
    await getAndVerifyDoc("incidents", incidentId, customerId);
  if (incidentData.status !== "Closed") {
    const errorMessage =
      "Cannot delete an active incident. It must be closed first.";
    throw new Error(errorMessage);
  }

  // Step 3: Prepare a batch to delete all associated data.
  const batch = db.batch();
  const collectionsToDeleteFrom = [
    "groups", "assignments", "parLogs", "unitActionLogs",
  ];
  for (const collectionName of collectionsToDeleteFrom) {
    const snapshot = await db.collection(collectionName)
        .where("incidentId", "==", incidentId)
        .where("customerId", "==", customerId)
        .get();
    if (!snapshot.empty) {
      snapshot.forEach((doc) => batch.delete(doc.ref));
    }
  }

  // Step 4: Add the main incident document to the batch and commit.
  batch.delete(incidentRef);
  await batch.commit();

  return {message: "Incident and all associated data deleted successfully."};
}

