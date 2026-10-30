"""List Mandate's MCP tools and call one read-only tool (get_company).

Usage:
    pip install -r requirements.txt
    python list_and_call.py              # get_company DK 24256790
    python list_and_call.py EE 12759581  # any country + registry code / name
"""

import asyncio
import json
import sys

from mcp import Client

URL = "https://mandateoffice.com/mcp"


async def main() -> None:
    country = sys.argv[1] if len(sys.argv) > 1 else "DK"
    query = sys.argv[2] if len(sys.argv) > 2 else "24256790"

    async with Client(URL) as client:
        tools = await client.list_tools()
        print(f"{len(tools.tools)} tools:")
        for tool in tools.tools:
            print(f"  - {tool.name}")

        result = await client.call_tool("get_company", {"country": country, "query": query})
        if result.is_error:
            print(f"\nget_company {country} {query} returned an error:")
        else:
            print(f"\nget_company {country} {query}:")
        data = result.structured_content
        if data is not None:
            print(json.dumps(data, indent=2, ensure_ascii=False))
        else:
            for block in result.content:
                print(getattr(block, "text", block))


if __name__ == "__main__":
    asyncio.run(main())
