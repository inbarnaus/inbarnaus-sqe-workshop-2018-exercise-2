import $ from 'jquery';
import {parseCode, subCode} from './code-analyzer';
const escodegen = require('escodegen');

$(document).ready(function () {
    $('#codeSubmissionButton').click(() => {
        let codeToParse = $('#codePlaceholder').val();
        let parsedCode = parseCode(codeToParse);
        $('#parsedCode').val(JSON.stringify(parsedCode, null, 2));
    });
    $('#symbolicButton').click(() => {
        let codeToParse = $('#codePlaceholder').val();
        let values = $('#values').val();
        let parsedCode = subCode(values, codeToParse);
        let code = escodegen.generate(parsedCode, {verbatim: 'colorLine'});
        $('#symSub').append(code);
    });
});

