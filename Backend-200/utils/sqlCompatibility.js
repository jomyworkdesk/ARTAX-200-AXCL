// Accept only trusted SQL expressions, never user-provided values.
const sqlInt = (expression) => {
    const text = `LTRIM(RTRIM(CONVERT(nvarchar(max), ${expression})))`;
    const digits = `(CASE WHEN LEFT(${text}, 1) IN (N'+', N'-') THEN SUBSTRING(${text}, 2, LEN(${text})) ELSE ${text} END)`;
    const magnitude = `SUBSTRING(${digits}, PATINDEX(N'%[^0]%', COALESCE(${digits}, N'') + N'1'), LEN(${digits}))`;
    const limit = `(CASE WHEN LEFT(${text}, 1) = N'-' THEN N'2147483648' ELSE N'2147483647' END)`;

    // Validate digits and the signed INT range before converting. Stripping
    // leading zeros also allows long, otherwise valid integer strings.
    return `CONVERT(int, CASE
        WHEN ${text} = N'' THEN N'0'
        WHEN ${digits} <> N''
            AND ${digits} COLLATE Latin1_General_BIN2 NOT LIKE N'%[^0-9]%'
            AND (LEN(${magnitude}) < 10
                OR (LEN(${magnitude}) = 10 AND ${magnitude} COLLATE Latin1_General_BIN2 <= ${limit}))
        THEN (CASE WHEN LEFT(${text}, 1) = N'-' THEN N'-' ELSE N'' END)
            + COALESCE(NULLIF(${magnitude}, N''), N'0')
        ELSE NULL
    END)`;
};

module.exports = { sqlInt };
