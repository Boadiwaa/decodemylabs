/**
 * Type definitions for all data entities.
 * JSDoc types give Copilot full knowledge of data shapes.
 */

/**
 * @typedef {Object} Patient
 * @property {number} id
 * @property {string} name
 * @property {string} dob - ISO date string (YYYY-MM-DD)
 * @property {'Male'|'Female'} gender
 * @property {string} profile_description
 * @property {string} initials - Two-letter initials
 * @property {string} color - Hex color for avatar
 */

/**
 * @typedef {Object} LabResult
 * @property {number} id
 * @property {number} patient_id
 * @property {string} test_name
 * @property {string} result_value
 * @property {string} normal_range
 * @property {string} date - ISO date string
 * @property {string} explanation
 */

/**
 * @typedef {Object} Reminder
 * @property {number} id
 * @property {number} patient_id
 * @property {string} test_name
 * @property {string} due_date - ISO date string
 * @property {string} message
 */

/**
 * @typedef {Object} Alert
 * @property {number} id
 * @property {number} patient_id
 * @property {string} alert_message
 * @property {'danger'|'warn'|'safe'} severity
 */

/**
 * @typedef {Object} TrendPoint
 * @property {string} date - Month abbreviation
 * @property {number} value
 */

/**
 * @typedef {Object} Trend
 * @property {number} id
 * @property {number} patient_id
 * @property {string} test_name
 * @property {string} unit
 * @property {TrendPoint[]} values
 */

/**
 * @typedef {Object} PatientExplanation
 * @property {string} en
 * @property {string} fr
 * @property {string} ak
 */

/**
 * @typedef {Object} AgentInput
 * @property {number} patientId
 * @property {LabResult[]} labResults
 * @property {TrendPoint[]} trendData
 * @property {'patient'} mode
 */

/**
 * @typedef {Object} AgentOutput
 * @property {string} agentName
 * @property {number} confidence - 0 to 1
 * @property {Object} output
 * @property {string} reasoning
 * @property {string[]} citations
 * @property {string[]} warnings
 * @property {string} timestamp
 */

export {};