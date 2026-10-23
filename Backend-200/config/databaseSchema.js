const DEFAULT_SCHEMA_MAP = {
    tables: {},
    columns: {}
};

const normalizeMap = (value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return {};
    }

    return Object.entries(value).reduce((result, [from, to]) => {
        if (typeof from === "string" && from.trim() && typeof to === "string" && to.trim()) {
            result[from.trim()] = to.trim();
        }

        return result;
    }, {});
};

const mergeSchemaMaps = (...maps) =>
    maps.reduce(
        (result, map) => ({
            tables: {
                ...result.tables,
                ...normalizeMap(map.tables)
            },
            columns: {
                ...result.columns,
                ...normalizeMap(map.columns)
            }
        }),
        { ...DEFAULT_SCHEMA_MAP }
    );

const escapeIdentifierPart = (identifier) =>
    `[${String(identifier).replace(/^\[|\]$/g, "").replace(/]/g, "]]")}]`;

const formatIdentifier = (identifier) => {
    if (identifier.includes("[") || identifier.includes("]")) {
        return identifier;
    }

    return identifier
        .split(".")
        .map((part) => part.trim())
        .filter(Boolean)
        .map(escapeIdentifierPart)
        .join(".");
};

const unquoteIdentifier = (identifier) =>
    String(identifier)
        .replace(/^\[|\]$/g, "")
        .replace(/]]/g, "]");

const getUnqualifiedIdentifier = (identifier) => {
    const parts = String(identifier)
        .split(".")
        .map((part) => unquoteIdentifier(part.trim()))
        .filter(Boolean);

    return parts[parts.length - 1] || identifier;
};

const buildIdentifierMap = () => {
    const schemaMap = mergeSchemaMaps();
    const entries = [
        ...Object.entries(schemaMap.tables).map(([from, to]) => [from, to, "table"]),
        ...Object.entries(schemaMap.columns).map(([from, to]) => [from, to, "column"])
    ];

    return entries
        .filter(([from, to]) => from !== to)
        .sort(([left], [right]) => right.length - left.length)
        .map(([from, to, kind]) => ({
            from,
            rawTo: to,
            to: formatIdentifier(to),
            kind,
            lowerFrom: from.toLowerCase()
        }));
};

const identifierMap = buildIdentifierMap();

const shouldSkipBareIdentifier = (sqlText, matchIndex) => {
    let previousIndex = matchIndex - 1;

    while (previousIndex >= 0 && /\s/.test(sqlText[previousIndex])) {
        previousIndex -= 1;
    }

    return sqlText[previousIndex] === "@";
};

const replaceIdentifiersInSegment = (segment) => {
    if (!identifierMap.length || !segment) return segment;

    let rewritten = segment;

    for (const { from, to, kind, lowerFrom } of identifierMap) {
        if (kind === "table") {
            const qualifiedBracketedPattern = new RegExp(
                `\\[[^\\]]+\\]\\.\\[${from.replace(/[[\]\\^$.*+?()|{}]/g, "\\$&")}\\]`,
                "gi"
            );
            rewritten = rewritten.replace(qualifiedBracketedPattern, to);

            const qualifiedBarePattern = new RegExp(
                `(?<![\\w@#])(?:\\[[^\\]]+\\]|[A-Za-z_][\\w$#]*)\\.${from.replace(/[\\^$.*+?()[\]{}|]/g, "\\$&")}(?![\\w])`,
                "gi"
            );
            rewritten = rewritten.replace(qualifiedBarePattern, to);
        }

        const bracketedPattern = new RegExp(
            `\\[${from.replace(/[[\]\\^$.*+?()|{}]/g, "\\$&")}\\]`,
            "gi"
        );
        rewritten = rewritten.replace(bracketedPattern, to);

        const barePattern = new RegExp(
            `(?<![\\w@#])${from.replace(/[\\^$.*+?()[\]{}|]/g, "\\$&")}(?![\\w])`,
            "gi"
        );
        rewritten = rewritten.replace(barePattern, (match, offset, wholeSql) => {
            if (match.toLowerCase() !== lowerFrom || shouldSkipBareIdentifier(wholeSql, offset)) {
                return match;
            }

            return to;
        });
    }

    return rewritten;
};

const rewriteSql = (statement) => {
    if (!identifierMap.length || typeof statement !== "string") {
        return statement;
    }

    let result = "";
    let index = 0;

    while (index < statement.length) {
        if (statement[index] === "'") {
            let end = index + 1;

            while (end < statement.length) {
                if (statement[end] === "'" && statement[end + 1] === "'") {
                    end += 2;
                    continue;
                }

                if (statement[end] === "'") {
                    end += 1;
                    break;
                }

                end += 1;
            }

            result += statement.slice(index, end);
            index = end;
            continue;
        }

        if (statement[index] === "-" && statement[index + 1] === "-") {
            const end = statement.indexOf("\n", index + 2);
            const commentEnd = end === -1 ? statement.length : end;
            result += statement.slice(index, commentEnd);
            index = commentEnd;
            continue;
        }

        if (statement[index] === "/" && statement[index + 1] === "*") {
            const end = statement.indexOf("*/", index + 2);
            const commentEnd = end === -1 ? statement.length : end + 2;
            result += statement.slice(index, commentEnd);
            index = commentEnd;
            continue;
        }

        const nextString = statement.indexOf("'", index);
        const nextLineComment = statement.indexOf("--", index);
        const nextBlockComment = statement.indexOf("/*", index);
        const nextStops = [nextString, nextLineComment, nextBlockComment].filter((value) => value !== -1);
        const nextStop = nextStops.length ? Math.min(...nextStops) : statement.length;

        result += replaceIdentifiersInSegment(statement.slice(index, nextStop));
        index = nextStop;
    }

    return result;
};

module.exports = {
    rewriteSql,
    schemaMapEnabled: identifierMap.length > 0,
    getSchemaMappings: () => identifierMap.map(({ from, to }) => ({ from, to })),
    resolveIdentifier: (identifier) => {
        const mapped = identifierMap.find(
            ({ lowerFrom }) => lowerFrom === String(identifier).toLowerCase()
        );

        return mapped?.rawTo || identifier;
    },
    formatIdentifier,
    unquoteIdentifier,
    getUnqualifiedIdentifier
};
