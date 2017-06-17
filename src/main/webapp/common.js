'use strict';

var BIGSERVER = '/tomcat/irma_big_server/api/';

var MESSAGES = {
    'error:no-results':         'Zoeken in het BIG register leverde geen resultaten op. Neem contact op met irma \'at\' privacybydesign.foundation als u wel in het BIG register staat.',
    'error:multiple-results':   'Meerdere resultaten gevonden.',
    'error:invalid-jwt':        'Kan de JWT niet verifieren - loopt de klok misschien ongelijk?',
    'error:big-request-failed': 'Kan niet communiceren met het BIG register.',
};

var credentialsJWT;

function init() {
    $('#request-attributes')
        .on('click', requestAttributes)
        .prop('disabled', false);
    $('#issue-attributes')
        .on('click', issueAttributes);
    $('#back-from-attributes')
        .on('click', cancelAttributes);
}

function requestAttributes() {
    // Indicate progress
    $('#result-alert').addClass('hidden');
    $('#btn-request').prop('disabled', true);
    showProgress('Requesting disclosure request...');

    $.ajax({
        url: BIGSERVER + 'request-search-attrs',
    }).done(function(jwt) {
        showProgress('Requesting iDIN attributes...');
        IRMA.verify(jwt,
        requestAttributesFromBackend, // success
        function(message) { // cancel
            requestEnd('cancel');
            // The user explicitly cancelled the request, so do nothing.
            console.warn('user cancelled disclosure');
        }, function(errormsg) { // error
            console.error('could not request iDIN attributes:', errormsg);
            requestEnd('danger', 'Kan de iDIN gegevens niet ophalen', errormsg);
        });
    }).fail(function(data) {
        requestEnd('danger', 'Kan geen verbinding maken met de backend server');
    });
}

function requestAttributesFromBackend(disclosureJWT) {
    console.log('got disclosure result JWT:', disclosureJWT);
    showProgress('Requesting BIG credentials...');
    $.ajax(BIGSERVER + 'request-attrs', {
        type: 'POST',
        data: disclosureJWT,
        processData: false, // unnecessary as we're sending a string
        contentType: 'text/plain',
    })
        .done(function(jwt) {
            credentialsJWT = jwt;
            console.log('issuing JWT', jwt);

            // Very crude JWT parser
            var credentials = JSON.parse(atob(jwt.split('.')[1]));

            // Show the new screen with the list of attributes and a button
            // to issue them.
            $('#window-before-request').hide();
            $('#window-after-request').show();
            $('#attributes .number').text(credentials.iprequest.request.credentials[0].attributes.bignumber);
            $('#attributes .startdate').text(credentials.iprequest.request.credentials[0].attributes.startdate);
            $('#attributes .profession').text(credentials.iprequest.request.credentials[0].attributes.profession);
            $('#attributes .specialism').text(credentials.iprequest.request.credentials[0].attributes.specialism);
            showProgress('Waiting for OK button...'); // invisible to user
        })
        .fail(function(jqXhr, textStatus) {
            var errormsg = jqXhr.responseText;
            console.error('failed to request credentials:', textStatus, errormsg);

            var message;
            if (errormsg.substr(0, 6) === 'error:') {
                if (errormsg in MESSAGES) {
                    message = MESSAGES[errormsg];
                } else {
                    // Fallback - message needs to be added to MESSAGES.
                    message = errormsg;
                }
            } else {
                // Most messages are prefixed with 'error:'. But some may not
                // be, for example, when there's a more severe configuration
                // problem in the server and the error is not generated by
                // the REST API. These are no 'user errors' or errors that occur
                // due to some issue on the client side - these are really our
                // fault.
                // The actual error can be seen in the developer console.
                message = 'Onbekend probleem';
            }

            if (errormsg === 'error:no-results') {
                requestEnd('danger', 'Niet gevonden in het BIG register', message);
            } else {
                requestEnd('danger', 'Kan de credentials niet aan de backend server vragen', message);
            }
        });
}

function showProgress(message) {
    console.log('progress:', message);
    $('#progress').text(message);
}


function requestEnd(result, message, errormsg) {
    console.log('user message: ' + result + ': ' + message);
    $('#btn-request').prop('disabled', false);
    $('#progress').text('');

    if (result !== 'cancel') {
        $('#result-alert')
            .removeClass('alert-success') // remove all 4 alert types
            .removeClass('alert-info')
            .removeClass('alert-warning')
            .removeClass('alert-danger')
            .addClass('alert-' + result)
            .text(message)
            .removeClass('hidden')
            .append('<br>')
            .append($('<small></small>').text(errormsg))
    }
}

function issueAttributes() {
    showProgress('Issuing credential...');
    IRMA.issue(credentialsJWT,
        function() { // success
            console.log('issue success!');
            requestEnd('success', 'Credential voor het BIG register vrijgegeven')

            // Go back to the start screen - we're done.
            $('#window-before-request').show();
            $('#window-after-request').hide();
        },
        function(msg) { // cancel
            console.warn('cancelled while issuing:', msg);
            requestEnd('cancel');
            // The user can try again now, or press 'cancel' on the issue screen.
        },
        function(errormsg) { // error
            console.error('error while issuing:', errormsg)
            requestEnd('danger', 'Kan het BIG credential niet vrijgeven', errormsg);

            // Go back to the start screen to show the error.
            $('#window-before-request').show();
            $('#window-after-request').hide();
        }
    );
}

function cancelAttributes() {
    requestEnd('cancel');
    $('#window-before-request').show();
    $('#window-after-request').hide();
}

init();
