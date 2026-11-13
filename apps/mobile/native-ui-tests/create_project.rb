# frozen_string_literal: true

require 'fileutils'
require 'base64'
require 'xcodeproj'

directory = File.expand_path(ARGV.fetch(0))
FileUtils.mkdir_p(directory)
bundle_identifier = ENV.fetch('TOLARIA_MOTION_APP_BUNDLE_ID', 'com.tolaria.mobile.dev')
raise 'Invalid motion-test app bundle identifier' unless bundle_identifier.match?(/\A[A-Za-z0-9.-]+\z/)

search = ENV.fetch('TOLARIA_MOTION_SEARCH', '?source=fixture&phoneState=list&editorMode=wysiwyg&layoutProbe=1')
raise 'Invalid motion-test launch search' unless search.start_with?('?') && !search.match?(/[\r\n]/)

configuration = File.join(directory, 'MotionHarnessConfiguration.swift')
search_data = Base64.strict_encode64(search)
File.write(configuration, <<~SWIFT)
  import Foundation

  enum MotionHarnessConfiguration {
    static let appBundleIdentifier = "#{bundle_identifier}"
    static let launchSearch = String(data: Data(base64Encoded: "#{search_data}")!, encoding: .utf8)!
  }
SWIFT
project = Xcodeproj::Project.new(File.join(directory, 'TabletPanelGestureTests.xcodeproj'))
target = project.new_target(:ui_test_bundle, 'TabletPanelGestureTests', :ios, '15.1')
sources = Dir.glob(File.expand_path('*Tests.swift', __dir__)).sort + [configuration]
target.add_file_references(sources.map { |source| project.main_group.new_file(source) })
target.build_configurations.each do |config|
  config.build_settings.merge!(
    'SWIFT_VERSION' => '5.0',
    'PRODUCT_BUNDLE_IDENTIFIER' => 'com.tolaria.mobile.tablet-gesture-tests',
    'GENERATE_INFOPLIST_FILE' => 'YES',
    'CODE_SIGNING_ALLOWED' => 'NO',
    'TARGETED_DEVICE_FAMILY' => '1,2',
    'ENABLE_TESTING_SEARCH_PATHS' => 'YES',
    'FRAMEWORK_SEARCH_PATHS' => ['$(inherited)', '$(PLATFORM_DIR)/Developer/Library/Frameworks'],
    'LD_RUNPATH_SEARCH_PATHS' => ['$(inherited)', '@executable_path/Frameworks', '@loader_path/Frameworks']
  )
end
project.save
scheme = Xcodeproj::XCScheme.new
scheme.add_build_target(target)
scheme.add_test_target(target)
scheme.save_as(project.path, 'TabletPanelGestureTests', true)
