//import * as esprima from 'esprima';
const esprima = require('esprima');
const escodegen = require('escodegen');

let vars = {};
let values = [];
let globals = {};
let colors = [];
let deletedRows = [];

let array =[];
let delimiter;
let qoutes;
let brackets1;
let brackets2;

const retValGl = (init) => {
    return init.type === 'Identifier' ? vars[init.name]:
        init.type === 'ArrayExpression' ? {'type': 'ArrayExpression', 'elements': init.elements.map(retValGl)} :
            init.type === 'BinaryExpression' ? {
                'type': 'BinaryExpression',
                'operator': init.operator,
                'left': retValGl(init.left),
                'right': retValGl(init.right),
                'loc': init.loc } :
                init.type === 'MemberExpression' ? vars[init.object.name].elements[init.property.value] :
                    init;
};

const glVarDecl = (rec) => {
    for (let i = 0; i < rec.declarations.length; i++) {
        let val = retValGl(rec.declarations[i].init);
        vars[rec.declarations[i].id.name] = val;
        rec.declarations[i].init = val;
    }
    return rec;
};


const OglVarDecl = (rec) => {
    for (let i = 0; i < rec.declarations.length; i++) {
        let val = retValGl(rec.declarations[i].init);
        vars[rec.declarations[i].id.name] = val;
        globals[rec.declarations[i].id.name] = val;
        //rec.declarations[i].init = val;
    }
    return rec;
};

const retExpGl = (body) => {
    return body.type === 'Identifier' ? vars[body.name] :
        body.type === 'AssignmentExpression' ? {
            'type': 'AssignmentExpression',
            'operator': body.operator,
            'left': body.left,
            'right': retExpGl(body.right)} :
            body.type === 'BinaryExpression' ? {
                'type': 'BinaryExpression',
                'operator': body.operator,
                'left': retExpGl(body.left),
                'right': retExpGl(body.right),
                'loc': body.loc } : recExpGl2(body);

};

const recExpGl2 = (body) =>{
    return body.type === 'ArrayExpression' ? {
        'type': 'ArrayExpression',
        'elements': body.elements.map(retExpGl)} :
        body.type === 'MemberExpression' ? vars[body.object.name].elements[body.property.value] :
            body;
};

const glExpDecl = (rec) => {
    let val = retExpGl(rec.expression);
    if(rec.expression.left.type === 'MemberExpression') {
        vars[rec.expression.left.object.name].elements[rec.expression.left.property.value] = val;
        return val;
    }
    vars[rec.expression.left.name] = val.right;
    rec.expression = val;
    return rec;
};

const OglExpDecl = (rec) => {
    let val = retExpGl(rec.expression);
    if(rec.expression.left.type === 'MemberExpression') {
        vars[rec.expression.left.object.name].elements[rec.expression.left.property.value] = val;
        globals[rec.expression.left.object.name].elements[rec.expression.left.property.value] = val;
        return val;
    }
    vars[rec.expression.left.name] = val.right;
    rec.expression = val;
    return rec;
};

const glFuncDecl = (rec) => {
    //values=stringToArray('1', ',');
    for (let i = 0; i < rec.params.length; i++) {
        vars[rec.params[i].name] = values[i];
        globals[rec.params[i].name] = values[i];
    }
    for (let i = 0; i < rec.body.body.length; i++) {
        rec.body.body[i] = typeHandler(rec.body.body[i]);
    }
    rec.body.body = removeExp(rec.body.body);
    return rec;
};

const typeHandler = (rec) =>{
    switch (rec.type) {
    case 'VariableDeclaration':
        return glVarDecl(rec);
    case 'IfStatement':
        return ifHandler(rec);
    case 'ReturnStatement':
        return returnHandler(rec);
    default:
        return typeHandler2(rec);
    }
};

const typeHandler2 = (rec) => {
    switch (rec.type) {
    case 'ExpressionStatement':
        return glExpDecl(rec);
    case 'WhileStatement':
        return whileHandler(rec);
    }
};

const returnHandler = (rec) => {
    rec.argument = retExpGl(rec.argument);
    return rec;
};

const evalTest = (rec) => {
    let color = eval(escodegen.generate(rec)) === true ? 1 : 0;
    colors.push([color, rec.loc.start.line]);
    return color;
};

const handleAlter = (rec) =>{
    if(rec.alternate !==null) {
        if (rec.alternate.type === 'BlockStatement')
            for (let i = 0; i < rec.alternate.body.length; i++) {
                rec.alternate.body[i] = typeHandler(rec.alternate.body[i]);
            }
        else
            rec.alternate = typeHandler(rec.alternate);
    }
    return rec;
};

const ifHandler = (rec) => {
    let table= vars;
    rec.test = retValGl(rec.test);
    let answer = evalTest(rec.test, rec.loc.start.line);
    rec.test.colorLine = answer? '<green>' + escodegen.generate(rec.test) + '</green>' : '<red>' + escodegen.generate(rec.test) + '</red>';
    for(let i=0; i<rec.consequent.body.length; i++)
        rec.consequent.body[i]=typeHandler(rec.consequent.body[i]);
    vars=table;
    rec= handleAlter(rec);
    vars=table;
    rec.consequent.body = removeExp(rec.consequent.body);
    if(rec.alternate !==null && rec.alternate.type === 'BlockStatement')
        rec.alternate.body = removeExp(rec.alternate.body);
    return rec;
};

const whileHandler = (rec) => {
    rec.test = retValGl(rec.test);
    for(let i=0; i<rec.body.body.length; i++)
        rec.body.body[i]=typeHandler(rec.body.body[i]);

    rec.body.body = removeExp(rec.body.body);

    return rec;
};

let globalHandlers = {
    'VariableDeclaration' : OglVarDecl,
    'ExpressionStatement' : OglExpDecl,
    'FunctionDeclaration' : glFuncDecl
};

const parseCode = (codeToParse) => {
    let pBody = esprima.parseScript(codeToParse, {loc: true});
    for (let i = 0; i < pBody.body.length; i++) {
        pBody.body[i] = globalHandlers[pBody.body[i].type](pBody.body[i]);
    }
    updateRows();
    return pBody;
};

const updateRows = () => {
    let counter =0;
    for(let i=0; i<colors.length; i++){
        for(let j=0; j<deletedRows.length; j++){
            if(colors[i][1]> deletedRows[j])
                counter++;
        }
        colors[i][1]=colors[i][1]-counter;
        counter=0;
    }
};

const subCode = (vals, codeToParse) => {
    values = [];
    values = stringToArray(vals, ',');
    vars=[];
    globals=[];
    colors = [];
    deletedRows = [];
    array =[];
    return parseCode(codeToParse);
};

const handleDelimiters = (val) => {
    if(qoutes!== -1 && qoutes<delimiter)
        delimiter = val.indexOf('\'', qoutes+1)+1;
    if(brackets1 !== -1 && brackets1<delimiter) {
        delimiter = brackets2 + 1;
        brackets1 = val.indexOf('[', brackets1+1);
        brackets2 = val.indexOf(']', brackets2+1);
    }
};

const stringToArray = (val, char) => {
    delimiter = val.indexOf(char);
    qoutes = val.indexOf('\'');
    brackets1 = val.indexOf('[');
    brackets2 = val.indexOf(']');
    while(delimiter !==-1){
        handleDelimiters(val);
        array.push(esprima.parseScript(val.substring(0, delimiter), { loc: true }).body[0].expression);
        val=val.substring(delimiter+1);
        delimiter = val.indexOf(char);
    }
    array.push(esprima.parseScript(val, { loc: true }).body[0].expression);
    return array;
};

const removeExp = (rec) => {
    let output = [];
    for(let i=0; i<rec.length; i++){
        if(rec[i].type === 'VariableDeclaration' || (rec[i].type === 'ExpressionStatement' && globals[rec[i].expression.left.name] === undefined)) {
            deletedRows.push(rec[i].loc.start.line);
        }
        else output.push(rec[i]);
    }
    return output;
};
/*
parseCode('let x= [1,2,3];\n' +
    'let y= x[0];\n' +
    'function foo(p){\n' +
    '   let z=x[2];\n' +
    '}a');
*/
export {parseCode, subCode};
