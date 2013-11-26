/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("resource:///modules/mailServices.js");
Components.utils.import("resource:///modules/ctypes.jsm");
Components.utils.import("resource://testing-common/mailnews/localAccountUtils.js");

var Cc = Components.classes;
var Ci = Components.interfaces;
var Cr = Components.results;
var CC = Components.Constructor;

// Ensure the profile directory is set up
do_get_profile();

// Import fakeserver
Components.utils.import("resource://testing-common/mailnews/maild.js");
Components.utils.import("resource://testing-common/mailnews/smtpd.js");

const SMTP_PORT = 1024+120;

// Setup the daemon and server
function setupServerDaemon(handler) {
  if (!handler)
    handler = function (d) { return new SMTP_RFC2821_handler(d); };
  let daemon = new smtpDaemon();
  let server = new nsMailServer(handler, daemon);
  return [daemon, server];
}

function getBasicSmtpServer() {
  // We need to have a default account for MAPI.
  localAccountUtils.loadLocalMailAccount();
  let server = localAccountUtils.create_outgoing_server(SMTP_PORT,
    "user", "password");
  // We also need to have a working identity, including an email address.
  localAccountUtils.associate_servers(localAccountUtils.incomingServer, server,
    true);
  let identity = localAccountUtils.msgAccount.defaultIdentity;
  identity.email = "tinderbox@tinderbox.invalid";

  return server;
}

/**
 * Returns a structure allowing access to all of the Simple MAPI functions.
 * The functions do not have the MAPI prefix on the variables. Also added are
 * the three structures needed for MAPI.
 */
function loadMAPILibrary() {
  // This is a hack to load the MAPI support in the current environment, as the
  // profile-after-change event is never sent out.
  var gMapiSupport = Cc["@mozilla.org/mapisupport;1"]
                       .getService(Ci.nsIObserver);
  gMapiSupport.observe(null, "profile-after-change", null);
  // Set some preferences to make MAPI (particularly blind MAPI, aka work
  // without a dialog box) work properly.
  Services.prefs.setBoolPref("mapi.blind-send.enabled", true);
  Services.prefs.setBoolPref("mapi.blind-send.warn", false);

  // The macros that are used in the definitions
  let WINAPI = ctypes.winapi_abi;
  let ULONG = ctypes.unsigned_long;
  let LHANDLE = ULONG.ptr;
  let LPSTR = ctypes.char.ptr;
  let LPVOID = ctypes.voidptr_t;
  let FLAGS = ctypes.unsigned_long;

  // Define all of the MAPI structs we need to use.
  let functionData = {};
  functionData.MapiRecipDesc = new ctypes.StructType("gMapi.MapiRecipDesc", [
    {ulReserved: ULONG}, {ulRecipClass: ULONG}, {lpszName: LPSTR},
    {lpszAddress: LPSTR}, {ulEIDSize: ULONG}, {lpEntryID: LPVOID}
  ]);
  let lpMapiRecipDesc = functionData.MapiRecipDesc.ptr;
  functionData.MapiFileDesc = new ctypes.StructType("gMapi.MapiFileDesc", [
    {ulReserved: ULONG}, {flFlags: ULONG}, {nPosition: ULONG},
    {lpszPathName: LPSTR}, {lpszFileName: LPSTR}, {lpFileType: LPVOID}
  ]);
  let lpMapiFileDesc = functionData.MapiFileDesc.ptr;
  functionData.MapiMessage = new ctypes.StructType("gMapi.MapiMessage", [
    {ulReserved: ULONG}, {lpszSubject: LPSTR}, {lpszNoteText: LPSTR},
    {lpszMessageType: LPSTR}, {lpszDateReceived: LPSTR},
    {lpszConversationID: LPSTR}, {flFlags: FLAGS},
    {lpOriginator: lpMapiRecipDesc}, {nRecipCount: ULONG},
    {lpRecips: lpMapiRecipDesc}, {nFileCount: ULONG}, {lpFiles: lpMapiFileDesc}
  ]);
  let lpMapiMessage = functionData.MapiMessage.ptr;

  // Load the MAPI library. We're using our definition instead of the global
  // MAPI definition.
  let mapi = ctypes.open("mozMapi32.dll");

  // Load the MAPI functions
  // MAPIAddress is not supported.
  functionData.DeleteMail = mapi.declare("MAPIDeleteMail", WINAPI, ULONG,
    LHANDLE, ULONG.ptr, LPSTR, FLAGS, ULONG);
  // MAPIDetails is not supported.
  functionData.FindNext = mapi.declare("MAPIFindNext", WINAPI, ULONG,
    LHANDLE, ULONG.ptr, LPSTR, LPSTR, FLAGS, ULONG, LPSTR);
  functionData.FreeBuffer = mapi.declare("MAPIFreeBuffer", WINAPI, ULONG,
    LPVOID);
  functionData.Logoff = mapi.declare("MAPILogoff", WINAPI, ULONG,
    LHANDLE, ULONG.ptr, FLAGS, ULONG);
  functionData.Logon = mapi.declare("MAPILogon", WINAPI, ULONG,
    ULONG.ptr, LPSTR, LPSTR, FLAGS, ULONG, LHANDLE.ptr);
  functionData.ReadMail = mapi.declare("MAPIReadMail", WINAPI, ULONG,
    LHANDLE, ULONG.ptr, LPSTR, FLAGS, ULONG, lpMapiMessage.ptr);
  functionData.ResolveName = mapi.declare("MAPIResolveName", WINAPI, ULONG,
    LHANDLE, ULONG.ptr, LPSTR, FLAGS, ULONG, lpMapiRecipDesc.ptr);
  // MAPISaveMail is not supported.
  functionData.SendDocuments = mapi.declare("MAPISendDocuments", WINAPI, ULONG,
    ULONG.ptr, LPSTR, LPSTR, LPSTR, ULONG);
  functionData.SendMail = mapi.declare("MAPISendMail", WINAPI, ULONG,
    LHANDLE, ULONG.ptr, lpMapiMessage, FLAGS, ULONG);

  return functionData;
}