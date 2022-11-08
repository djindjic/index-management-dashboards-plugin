/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { Component } from "react";
import _ from "lodash";
import { RouteComponentProps } from "react-router-dom";
import { ContentPanel } from "../../../../components/ContentPanel";
import IndexService from "../../../../services/IndexService";
import RollupService from "../../../../services/RollupService";
import { BREADCRUMBS } from "../../../../utils/constants";
import { getErrorMessage } from "../../../../utils/helpers";
import { CoreServicesContext } from "../../../../components/core_services";
import { EuiComboBox, EuiFlexGroup, EuiFlexItem, EuiSearchBar, Query } from "@elastic/eui";
import { FieldItem } from "../../../../../models/interfaces";
import IndexPreview from "../../components/IndexPreview";
import { parseFieldOptions, compareFieldItem } from "../../utils/helpers";

interface IndicesProps extends RouteComponentProps {
  indexService: IndexService;
  rollupService: RollupService;
}

interface IndicesState {
  isLoading?: boolean;
  indices?: { label: string; value: string }[];
  sourceIndex?: { label: string; value: string }[];
  columns: any[];
  raw_data: any[];

  mappings: any[];
  fields: any[];
  allMappings: any[];
}

export default class Indices extends Component<IndicesProps, IndicesState> {
  static contextType = CoreServicesContext;
  constructor(props: IndicesProps) {
    super(props);

    this.state = {
      isLoading: false,
      indices: [],
      columns: [],
      raw_data: [],

      mappings: [],
      fields: [],
      allMappings: [],

      query: Query.parse(""),
    };

    this.getIndices = _.debounce(this.getIndices, 500, { leading: true });
  }

  async componentDidMount() {
    this.context.chrome.setBreadcrumbs([BREADCRUMBS.INDEX_MANAGEMENT, BREADCRUMBS.INDICES]);
    await this.getIndices();
  }

  // async componentDidUpdate(prevProps: IndicesProps, prevState: IndicesState) {
  //   const prevQuery = SearchIndices.getQueryObjectFromState(prevState);
  //   const currQuery = SearchIndices.getQueryObjectFromState(this.state);
  //   if (!_.isEqual(prevQuery, currQuery)) {
  //     await this.getIndices();
  //   }
  // }

  getIndices = async (): Promise<void> => {
    this.setState({ isLoading: true });
    try {
      const { indexService } = this.props;

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
        this.setState({
          isLoading: false,
          indices: indices.map((i) => ({ label: i.index, value: i.index })),
        });
      } else {
        this.context.notifications.toasts.addDanger(getIndicesResponse.error);
      }
    } catch (err) {
      this.context.notifications.toasts.addDanger(getErrorMessage(err, "There was a problem loading the indices"));
    }
  };

  onIndexChange = async (value) => {
    this.setState({ sourceIndex: value });

    const srcIndex = value[0].value;

    if (!srcIndex.length) return;
    try {
      const { rollupService, indexService } = this.props;
      const response = await rollupService.getMappings(srcIndex);
      if (response.ok) {
        let allMappings: FieldItem[][] = [];
        const mappings = response.response;
        //Push mappings array to allMappings 2D array first
        for (let index in mappings) {
          allMappings.push(parseFieldOptions("", mappings[index].mappings.properties));
        }
        //Find intersect from all mappings
        const fields = allMappings.reduce((mappingA, mappingB) =>
          mappingA.filter((itemA) => mappingB.some((itemB) => compareFieldItem(itemA, itemB)))
        );

        const columns = fields.map((field) => ({
          id: field.label,
        }));

        const raw_data = [];

        const returnLimit = 100;

        const searchIndexResponse = await indexService.searchIndexData(
          srcIndex,
          {
            from: 0,
            size: returnLimit,
          },
          ""
        );

        console.log(searchIndexResponse);

        for (let i = 0; i < searchIndexResponse.response.totalResults; i++) {
          let row = {};
          columns.forEach((column) => {
            row = { ...row, [column.id]: searchIndexResponse.response.results[i][column.id] };
          });
          raw_data.push(row);
        }

        console.log(raw_data);
        this.setState({ columns, raw_data });
      } else {
        this.context.notifications.toasts.addDanger(`Could not load fields: ${response.error}`);
      }
    } catch (err) {
      this.context.notifications.toasts.addDanger(getErrorMessage(err, "Could not load fields"));
    }
  };

  render() {
    const { isLoading, indices, columns, raw_data, sourceIndex } = this.state;

    const schema = {
      strict: true,
      fields: {
        indices: {
          type: "string",
        },
        data_streams: {
          type: "string",
        },
      },
    };

    const filters = undefined;

    const onSearchChange = ({ query, queryText, error }): void => {
      console.log(query, queryText, error);
    };

    return (
      <div>
        <ContentPanel bodyStyles={{ padding: "initial" }} title="Preview Indices">
          <EuiFlexGroup style={{ padding: "0px 5px" }} direction="column">
            <EuiFlexItem>
              <EuiComboBox
                placeholder="Select source index"
                options={indices}
                onChange={this.onIndexChange}
                singleSelection={{ asPlainText: true }}
                selectedOptions={sourceIndex}
                isLoading={isLoading}
              />
            </EuiFlexItem>
            <EuiFlexItem>
              <EuiSearchBar box={{ placeholder: "Search", schema, incremental: true }} onChange={onSearchChange} filters={filters} />
            </EuiFlexItem>
            <EuiFlexItem>{raw_data && raw_data.length > 0 ? <IndexPreview columns={columns} raw_data={raw_data} /> : ""}</EuiFlexItem>
          </EuiFlexGroup>
        </ContentPanel>
      </div>
    );
  }
}
