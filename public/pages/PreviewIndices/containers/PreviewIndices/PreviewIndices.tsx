/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useContext, useEffect } from "react";
import { RouteComponentProps } from "react-router-dom";
import { ContentPanel } from "../../../../components/ContentPanel";
import IndexService from "../../../../services/IndexService";
import RollupService from "../../../../services/RollupService";
import { BREADCRUMBS } from "../../../../utils/constants";
import { getErrorMessage } from "../../../../utils/helpers";
import { CoreServicesContext } from "../../../../components/core_services";
import { EuiComboBox, EuiComboBoxOptionOption, EuiFlexGroup, EuiFlexItem, EuiSearchBar, EuiText, EuiToolTip, Query } from "@elastic/eui";
import { SchemaType } from "@elastic/eui/src/components/search_bar/search_box";
import { FieldItem } from "../../../../../models/interfaces";
import { OnSearchChangeArgs } from "../../../../models/interfaces";
import IndexPreview from "../../components/IndexPreview";
import { parseFieldOptions, compareFieldItem } from "../../utils/helpers";

const mapDataToTable = (data: { [key: string]: unknown }[], columns: ColumnInfo[]) => {
  console.log("mapDataToTable");
  const raw_data: Array<unknown> = [];

  if (!data || data.length == 0) {
    return raw_data;
  }

  for (let i = 0; i < data.length; i++) {
    let row = {};
    columns.forEach((column) => {
      row = { ...row, [column.id]: data[i][column.id] };
    });
    raw_data.push(row);
  }
  return raw_data;
};

const mapToColumns = (mappings: any): ColumnInfo[] => {
  console.log("mapToColumns");
  let allMappings: FieldItem[][] = [];
  //Push mappings array to allMappings 2D array first
  for (let index in mappings) {
    allMappings.push(parseFieldOptions("", mappings[index].mappings.properties));
  }
  //Find intersect from all mappings
  const fields = allMappings.reduce((mappingA, mappingB) =>
    mappingA.filter((itemA) => mappingB.some((itemB) => compareFieldItem(itemA, itemB)))
  );

  console.log(fields);

  const columns = fields
    .filter((f) => f.type === "keyword" || f.type === "keyword" || f.type === "text")
    .map((field) => {
      return {
        id: field.label,
        type: "string",
        display: (
          <div>
            <EuiToolTip content={field.label}>
              <EuiText size="s">
                <b>{field.label}</b>
              </EuiText>
            </EuiToolTip>
          </div>
        ),
      };
    });

  return columns;
};

interface IndicesProps extends RouteComponentProps {
  indexService: IndexService;
  rollupService: RollupService;
}

interface ColumnInfo {
  id: string;
  type: string;
}

interface IndicesState {
  indices?: { label: string; value: string }[];
  sourceIndex?: EuiComboBoxOptionOption<string>[];
  columns: ColumnInfo[];
  raw_data?: unknown[];
  query?: Query;
  schema?: SchemaType;
}

const returnLimit = 1000;

export default ({ indexService, rollupService }: IndicesProps) => {
  const context = useContext(CoreServicesContext);

  const [state, setState] = useState<IndicesState>({
    indices: [],
    columns: [],
    raw_data: [],
    query: Query.parse(""),
  });

  useEffect(() => {
    console.log("useEffect - getIndices");
    context?.chrome.setBreadcrumbs([BREADCRUMBS.INDEX_MANAGEMENT, BREADCRUMBS.INDICES]);

    const getIndices = async (): Promise<void> => {
      console.log("getIndices");
      try {
        const getIndicesResponse = await indexService.getIndices({
          from: 0,
          size: 50,
          search: "",
          sortField: "index",
          sortDirection: "desc",
          showDataStreams: false,
        });

        if (getIndicesResponse.ok) {
          const { indices } = getIndicesResponse.response;
          setState({
            ...state,
            indices: indices.map((i) => ({ label: i.index, value: i.index })),
          });
        } else {
          context?.notifications.toasts.addDanger(getIndicesResponse.error);
        }
      } catch (err) {
        context?.notifications.toasts.addDanger(getErrorMessage(err, "There was a problem loading the indices"));
      }
    };
    getIndices();
  }, []);

  const getData = async (srcIndex: string, columns: ColumnInfo[], query?: object) => {
    console.log("getData");

    try {
      const searchIndexResponse = await indexService.searchIndexData(
        srcIndex,
        {
          from: 0,
          size: returnLimit,
        },
        query ? { query } : {}
      );

      if (searchIndexResponse.ok) {
        return mapDataToTable(searchIndexResponse.response.results, columns);
      } else {
        context?.notifications.toasts.addDanger(searchIndexResponse.error);
      }
    } catch (err) {
      context?.notifications.toasts.addDanger(getErrorMessage(err, "There was a problem loading data"));
    }
  };

  const getColumns = async (srcIndex: string): Promise<ColumnInfo[]> => {
    console.log("getColumns");
    try {
      const response = await rollupService.getMappings(srcIndex);
      if (response.ok) {
        const columns = mapToColumns(response.response);

        return columns;
      } else {
        context?.notifications.toasts.addDanger(`Could not load fields: ${response.error}`);
      }
    } catch (err) {
      context?.notifications.toasts.addDanger(getErrorMessage(err, "Could not load fields"));
    }

    return [];
  };

  const onIndexChange = async (value: Array<EuiComboBoxOptionOption<string>>) => {
    console.log("onIndexChange");
    if (value.length === 0) {
      return;
    }

    const srcIndex = value[0].value;

    if (!srcIndex) {
      return;
    }

    const columns = await getColumns(srcIndex);
    const raw_data = await getData(srcIndex, columns);

    let fields = {};

    columns?.forEach((column) => {
      fields = { ...fields, [column.id]: { type: column.type } };
    });

    const schema = {
      strict: true,
      fields,
    };

    setState({ columns, raw_data, sourceIndex: value, schema });
  };

  const onSearchChange = async ({ query, error }: OnSearchChangeArgs): Promise<void> => {
    console.log("onSearchChange");
    if (error) {
      return;
    }

    const q = EuiSearchBar.Query.toESQuery(query);

    const { sourceIndex, columns } = state;

    if (sourceIndex && sourceIndex.length > 0 && sourceIndex[0].value && columns) {
      const raw_data = await getData(sourceIndex[0].value, columns, q);

      setState((s) => ({ ...s, raw_data }));
    }
  };

  return (
    <div>
      <ContentPanel bodyStyles={{ padding: "initial" }} title="Preview Indices">
        <EuiFlexGroup style={{ padding: "0px 5px" }} direction="column">
          <EuiFlexItem>
            <EuiComboBox
              placeholder="Select source index"
              options={state.indices}
              onChange={onIndexChange}
              singleSelection={{ asPlainText: true }}
              selectedOptions={state.sourceIndex}
            />
          </EuiFlexItem>
          <EuiFlexItem>
            <EuiSearchBar box={{ placeholder: "Search", schema: state.schema, incremental: true }} onChange={onSearchChange} />
          </EuiFlexItem>
          <EuiFlexItem>
            {state.raw_data && state.raw_data.length > 0 ? <IndexPreview columns={state.columns} raw_data={state.raw_data} /> : ""}
          </EuiFlexItem>
        </EuiFlexGroup>
      </ContentPanel>
    </div>
  );
};
