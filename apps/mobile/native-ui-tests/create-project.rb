require 'fileutils'
require 'xcodeproj'

directory = File.expand_path(ARGV.fetch(0))
FileUtils.mkdir_p(directory)
project = Xcodeproj::Project.new(File.join(directory, 'TabletPanelGestureTests.xcodeproj'))
target = project.new_target(:ui_test_bundle, 'TabletPanelGestureTests', :ios, '15.1')
source = File.expand_path('TabletPanelGestureTests.swift', __dir__)
target.add_file_references([project.main_group.new_file(source)])
target.build_configurations.each do |config|
  config.build_settings.merge!({
    'SWIFT_VERSION' => '5.0',
    'PRODUCT_BUNDLE_IDENTIFIER' => 'com.tolaria.mobile.tablet-gesture-tests',
    'GENERATE_INFOPLIST_FILE' => 'YES',
    'CODE_SIGNING_ALLOWED' => 'NO',
    'TARGETED_DEVICE_FAMILY' => '2',
    'ENABLE_TESTING_SEARCH_PATHS' => 'YES',
    'FRAMEWORK_SEARCH_PATHS' => ['$(inherited)', '$(PLATFORM_DIR)/Developer/Library/Frameworks'],
    'LD_RUNPATH_SEARCH_PATHS' => ['$(inherited)', '@executable_path/Frameworks', '@loader_path/Frameworks']
  })
end
project.save
scheme = Xcodeproj::XCScheme.new
scheme.add_build_target(target)
scheme.add_test_target(target)
scheme.save_as(project.path, 'TabletPanelGestureTests', true)
