/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

Components.utils.import("resource:///modules/mimeParser.jsm");

function run_test() {
  // Set up an SMTP server and the MAPI daemon.
  getBasicSmtpServer();
  let [daemon, server] = setupServerDaemon();
  server.start(SMTP_PORT);
  let mapi = loadMAPILibrary();

  // Build a message using the MAPI interface.
  let message = new mapi.MapiMessage();
  message.lpszSubject = ctypes.char.array()("Hello, MAPI!");
  message.lpszNoteText = ctypes.char.array()("I successfully sent a message!");
  message.lpszMessageType = ctypes.char.array()("");
  message.lpFiles = null;
  let recipient = new mapi.MapiRecipDesc();
  recipient.ulRecipClass = 1; /* MAPI_TO */
  recipient.lpszName = ctypes.char.array()("John Doe");
  recipient.lpszAddress = ctypes.char.array()("SMTP:john.doe@example.com");
  message.nRecipCount = 1;
  message.lpRecips = recipient.address();

  // Use MAPISendMail to send this message.
  mapi.SendMail(null /* No session */, null /* No HWND */, message.address(),
    0x2 /* MAPI_NEW_SESSION */, 0);

  // Check that the post has the correct information.
  let [headers, body] = MimeParser.extractHeadersAndBody(daemon.post);
  do_check_eq(headers.get("from")[0], "tinderbox@tinderbox.invalid");
  do_check_eq(headers.get("to")[0], "john.doe@example.com");
  do_check_eq(headers.get("subject")[0], "Hello, MAPI!");
  do_check_eq(body.trim(), "I successfully sent a message!");

  server.stop();
}